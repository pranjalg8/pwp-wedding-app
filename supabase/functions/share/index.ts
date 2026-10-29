// Public endpoint behind the planner's share links. A visitor sends the link secret; it is hashed and matched
// against share_links (never stored in the clear). An unknown, expired or revoked link all look the same: a plain
// 404. A good link returns only the sections it was created for, with money, guest, honeymoon and contact
// details left out unless that switch was turned on for the link. Nothing here ever returns messages, the
// audit log, profiles, email addresses or source ids.
// An edit link may also change two things, and only these: a task's status and a household's RSVP counts for a
// day it is already invited to. Nothing is created or deleted, and money is never touched. Each change is
// recorded in the audit log under the link's name.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
const notAvailable = () => json({ error: 'not_available' }, 404);

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
// deno-lint-ignore no-explicit-any
async function all(p: PromiseLike<{ data: any; error: { message: string } | null }>): Promise<Row[]> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

type Flags = { money: boolean; guests: boolean; honeymoon: boolean; contacts: boolean };

// Free text can mention amounts or phone numbers ("₹10,000 token paid", "call 98765 43210"). When a switch is off,
// those are masked. This is best effort: the switches, not this filter, are what keep the sensitive sections out.
const MONEY = /(?:₹|rs\.?\s?|inr\s?)\d[\d,]*(?:\.\d+)?(?:\s?(?:lakhs?|lacs?|l|k|cr|crores?)\b)?|\b\d[\d,]*(?:\.\d+)?\s?(?:lakhs?|lacs?|l|k|crores?)\b/gi;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;
function scrub(text: unknown, f: Flags): string | null {
  if (typeof text !== 'string' || text === '') return null;
  let t = text;
  if (!f.money) t = t.replace(MONEY, '₹•••');
  if (!f.contacts) {
    t = t.replace(EMAIL, '•••').replace(PHONE, (m) => (m.replace(/\D/g, '').length >= 9 && !/^\d{4}-\d{2}-\d{2}$/.test(m.trim()) ? '•••' : m));
  }
  return t;
}

// Mask every text value in a response, whatever field it is in, so a stray amount or phone number in a title,
// name or note cannot get through when its switch is off. Ids are left alone: a uuid can look like a phone number.
function cleanAll(v: unknown, f: Flags): unknown {
  if (f.money && f.contacts) return v;
  if (typeof v === 'string') return scrub(v, f) ?? v;
  if (Array.isArray(v)) return v.map((x) => cleanAll(x, f));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, k === 'id' ? x : cleanAll(x, f)]));
  return v;
}

const isDone = (s: string) => s === 'done' || s === 'decided';

function householdStatus(persons: number, rsvps: Row[]) {
  if (rsvps.length === 0) return 'not_invited';
  const noReply = (r: Row) => Math.max(0, persons - r.coming - r.maybe - r.declined);
  if (rsvps.some((r) => noReply(r) > 0)) return 'waiting';
  if (rsvps.some((r) => r.coming > 0)) return 'coming';
  if (rsvps.some((r) => r.maybe > 0)) return 'maybe';
  return 'declined';
}

const TASK_STATUSES = ['open', 'in_progress', 'decided', 'done'];
const isCount = (n: unknown, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max;

// The only two writes a link can make. Each goes through a client that names the link, so the audit trigger
// records "who" as the link rather than as the sync.
async function applyEdit(link: Row, body: Row, canEditTasks: boolean, canEditRsvp: boolean) {
  if (link.access !== 'edit') return json({ error: 'not_allowed' }, 403);
  const actor = `Shared link: ${String(link.label).replace(/[^\x20-\x7e]/g, '').slice(0, 60) || 'unnamed'}`;
  const sbw = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
    global: { headers: { 'x-actor': actor } },
  });

  if (body.action === 'task_status') {
    if (!canEditTasks) return json({ error: 'not_allowed' }, 403);
    if (typeof body.taskId !== 'string' || !TASK_STATUSES.includes(body.status)) return json({ error: 'bad_request' }, 400);
    const { data, error } = await sbw.from('tasks').update({ status: body.status }).eq('id', body.taskId).select('id');
    if (error) throw new Error(error.message);
    return data?.length ? json({ ok: true }) : json({ error: 'not_found' }, 404);
  }

  if (body.action === 'rsvp') {
    if (!canEditRsvp) return json({ error: 'not_allowed' }, 403);
    if (typeof body.guestId !== 'string' || typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return json({ error: 'bad_request' }, 400);
    const { data: g } = await sbw.from('guests').select('persons').eq('id', body.guestId).maybeSingle();
    if (!g) return json({ error: 'not_found' }, 404);
    const { coming, maybe, declined } = body;
    if (!isCount(coming, g.persons) || !isCount(maybe, g.persons) || !isCount(declined, g.persons) || coming + maybe + declined > g.persons) {
      return json({ error: 'bad_request' }, 400);
    }
    // Update only: a household already invited to that day. A link cannot invite anyone.
    const { data, error } = await sbw.from('guest_rsvps').update({ coming, maybe, declined }).eq('guest_id', body.guestId).eq('event_date', body.date).select('id');
    if (error) throw new Error(error.message);
    return data?.length ? json({ ok: true }) : json({ error: 'not_found' }, 404);
  }

  return json({ error: 'bad_request' }, 400);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'bad_request' }, 405);

  let token = '';
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try {
    body = await req.json();
    token = typeof body?.token === 'string' ? body.token : '';
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return notAvailable();

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  try {
    const { data: link } = await sb.from('share_links').select('*').eq('token_hash', await sha256Hex(token)).maybeSingle();
    if (!link || link.revoked_at || new Date(link.expires_at).getTime() <= Date.now()) return notAvailable();

    // Count the visit, but not more than every few minutes so the log stays readable.
    const last = link.last_used_at ? new Date(link.last_used_at).getTime() : 0;
    if (Date.now() - last > 5 * 60 * 1000) {
      await sb.from('share_links').update({ last_used_at: new Date().toISOString(), use_count: link.use_count + 1 }).eq('id', link.id);
    }

    const f: Flags = { money: !!link.show_money, guests: !!link.show_guests, honeymoon: !!link.show_honeymoon, contacts: !!link.show_contacts };
    const want = new Set<string>(link.sections);
    const canEdit = link.access === 'edit';
    const canEditTasks = canEdit && want.has('tasks');
    const canEditRsvp = canEdit && want.has('guests') && f.guests;

    if (body.action !== undefined) {
      if (typeof body.action !== 'string') return json({ error: 'bad_request' }, 400);
      return await applyEdit(link, body, canEditTasks, canEditRsvp);
    }
    const topics = await all(sb.from('topics').select('id, key, label'));
    const topicLabel = Object.fromEntries(topics.map((t) => [t.id, t.label]));

    const needTasks = want.has('home') || want.has('tasks') || want.has('vendors');
    const tasks = needTasks ? await all(sb.from('tasks').select('id, title, topic_id, owner, priority, due_date, status, summary, sort_order').order('sort_order')) : [];
    const options = needTasks ? await all(sb.from('task_options').select('id, task_id, name, status, summary, why_note, metadata, sort_order').order('sort_order')) : [];
    const items = want.has('tasks') && f.money ? await all(sb.from('planning_items').select('task_id, status, amount, amount_kind').not('task_id', 'is', null)) : [];

    const data: Record<string, unknown> = {};

    if (want.has('home')) {
      const facts = await all(sb.from('planning_items').select('slug, metadata').eq('slug', 'dates.wedding'));
      const start: string = facts[0]?.metadata?.start ?? '2027-02-14';
      const end: string = facts[0]?.metadata?.end ?? start;
      const open = tasks.filter((t) => !isDone(t.status));
      const hasChosen = (id: string) => options.some((o) => o.task_id === id && o.status === 'chosen');
      const undecided = open.filter((t) => options.some((o) => o.task_id === t.id) && !hasChosen(t.id));
      data.home = {
        weddingStart: start,
        weddingEnd: end,
        daysToGo: Math.ceil((Date.parse(`${start}T00:00:00+05:30`) - Date.now()) / 86_400_000),
        taskCounts: {
          open: tasks.filter((t) => t.status === 'open').length,
          inProgress: tasks.filter((t) => t.status === 'in_progress').length,
          decided: tasks.filter((t) => t.status === 'decided').length,
          done: tasks.filter((t) => t.status === 'done').length,
        },
        upcoming: open
          .filter((t) => t.due_date)
          .sort((a, b) => a.due_date.localeCompare(b.due_date))
          .slice(0, 6)
          .map((t) => ({ title: t.title, due_date: t.due_date, owner: t.owner, priority: t.priority })),
        needsDecision: undecided.slice(0, 6).map((t) => t.title),
      };
    }

    if (want.has('tasks')) {
      data.tasks = tasks.map((t) => {
        const mine = items.filter((i) => i.task_id === t.id);
        let money: Row | undefined;
        if (f.money) {
          let paid = 0;
          let planned = 0;
          const open: number[] = [];
          for (const i of mine) {
            const amt = Number(i.amount) || 0;
            if (!amt) continue;
            const settled = i.status === 'decided' || i.status === 'done';
            const kind = i.amount_kind ?? 'quote';
            if (kind === 'paid') paid += amt;
            else if (kind === 'planned' || settled) planned += amt;
            else open.push(amt);
          }
          money = { paid, planned, openLow: open.length ? Math.min(...open) : 0, openHigh: open.length ? Math.max(...open) : 0 };
        }
        return {
          ...(canEditTasks ? { id: t.id } : {}),
          title: t.title,
          area: t.topic_id ? topicLabel[t.topic_id] ?? null : null,
          status: t.status,
          priority: t.priority,
          owner: t.owner,
          due_date: t.due_date,
          summary: scrub(t.summary, f),
          money,
          options: options
            .filter((o) => o.task_id === t.id)
            .map((o) => ({
              name: o.name,
              status: o.status,
              summary: scrub(o.summary, f),
              why_note: scrub(o.why_note, f),
              contact: f.contacts ? { person: o.metadata?.contact_person ?? null, phone: o.metadata?.phone ?? null, email: o.metadata?.email ?? null } : undefined,
            })),
        };
      });
    }

    if (want.has('functions')) {
      const fns = await all(sb.from('wedding_functions').select('name, event_date, slot, theme, colours, avoid_colours, notes, status, family_only').order('sort_order'));
      data.functions = fns.map((x) => ({ ...x, notes: scrub(x.notes, f), theme: scrub(x.theme, f) }));
    }

    let guests: Row[] = [];
    let rsvps: Row[] = [];
    if (want.has('guests') || want.has('rooms')) {
      guests = await all(sb.from('guests').select('id, name, family_members, persons, list_group, relation, location, sort_order').order('sort_order'));
      rsvps = await all(sb.from('guest_rsvps').select('guest_id, event_date, coming, maybe, declined'));
    }

    if (want.has('guests')) {
      const counts: Record<string, { households: number; people: number }> = {
        coming: { households: 0, people: 0 },
        maybe: { households: 0, people: 0 },
        declined: { households: 0, people: 0 },
        waiting: { households: 0, people: 0 },
        not_invited: { households: 0, people: 0 },
      };
      const byDay: Record<string, { coming: number; maybe: number; declined: number; noReply: number }> = {};
      const list: Row[] = [];
      for (const g of guests) {
        const mine = rsvps.filter((r) => r.guest_id === g.id);
        const st = householdStatus(g.persons, mine);
        counts[st].households += 1;
        counts[st].people += g.persons;
        for (const r of mine) {
          const d = (byDay[r.event_date] ??= { coming: 0, maybe: 0, declined: 0, noReply: 0 });
          d.coming += r.coming;
          d.maybe += r.maybe;
          d.declined += r.declined;
          d.noReply += Math.max(0, g.persons - r.coming - r.maybe - r.declined);
        }
        if (f.guests) {
          list.push({
            ...(canEditRsvp ? { id: g.id } : {}),
            name: g.name,
            family_members: g.family_members,
            persons: g.persons,
            group: g.list_group,
            relation: g.relation,
            location: g.location,
            status: st,
            answers: mine.sort((a, b) => a.event_date.localeCompare(b.event_date)).map((r) => ({ date: r.event_date, coming: r.coming, maybe: r.maybe, declined: r.declined })),
          });
        }
      }
      data.guests = { households: guests.length, people: guests.reduce((a, g) => a + g.persons, 0), counts, byDay, list: f.guests ? list : null };
    }

    if (want.has('rooms')) {
      const sites = await all(sb.from('stay_sites').select('id, name, role, has_lift, floors, people_per_room, distance_note, booking_note, notes, sort_order').order('sort_order'));
      const nights = await all(sb.from('stay_nights').select('site_id, night, rooms').order('night'));
      const stays = await all(sb.from('guest_stays').select('guest_id, site_id, rooms'));
      data.rooms = {
        sites: sites.map((s) => ({
          name: s.name,
          role: s.role,
          has_lift: s.has_lift,
          floors: s.floors,
          people_per_room: s.people_per_room,
          distance_note: scrub(s.distance_note, f),
          booking_note: scrub(s.booking_note, f),
          notes: scrub(s.notes, f),
          nights: nights.filter((n) => n.site_id === s.id).map((n) => ({ night: n.night, rooms: n.rooms })),
          placedRooms: stays.filter((x) => x.site_id === s.id).reduce((a, x) => a + Number(x.rooms), 0),
        })),
        placements: f.guests
          ? stays.map((x) => ({ name: guests.find((g) => g.id === x.guest_id)?.name ?? 'Household', site: sites.find((s) => s.id === x.site_id)?.name ?? '', rooms: Number(x.rooms) }))
          : null,
      };
    }

    if (want.has('budget')) {
      if (!f.money) {
        data.budget = { hidden: 'money' };
      } else {
        const settings = (await all(sb.from('budget_settings').select('total_budget, funds_available, funds_as_of, monthly_addition')))[0] ?? null;
        const payments = await all(sb.from('payments').select('paid_on, payee, amount, purpose, topic_id').order('paid_on', { ascending: false }));
        const schedule = await all(sb.from('payment_schedule').select('payee, amount, due_date, status, is_estimate, note, topic_id').order('due_date'));
        const areas = await all(sb.from('budget_areas').select('topic_id, allocation'));
        data.budget = {
          settings,
          payments: payments.map((p) => ({ paid_on: p.paid_on, payee: p.payee, amount: Number(p.amount), purpose: p.purpose, area: p.topic_id ? topicLabel[p.topic_id] ?? null : null })),
          schedule: schedule.map((s) => ({ payee: s.payee, amount: Number(s.amount), due_date: s.due_date, status: s.status, is_estimate: s.is_estimate, note: s.note, area: s.topic_id ? topicLabel[s.topic_id] ?? null : null })),
          areas: areas.map((a) => ({ area: topicLabel[a.topic_id] ?? null, allocation: Number(a.allocation) })),
        };
      }
    }

    if (want.has('vendors')) {
      data.vendors = options
        .filter((o) => o.metadata && (o.metadata.contact_person || o.metadata.phone || o.metadata.email))
        .map((o) => ({
          name: o.name,
          task: tasks.find((t) => t.id === o.task_id)?.title ?? null,
          status: o.status,
          contact: f.contacts ? { person: o.metadata.contact_person ?? null, phone: o.metadata.phone ?? null, email: o.metadata.email ?? null } : null,
        }));
    }

    if (want.has('honeymoon')) {
      if (!f.honeymoon) {
        data.honeymoon = { hidden: 'honeymoon' };
      } else {
        const topic = topics.find((t) => t.key === 'honeymoon');
        const rows = topic ? await all(sb.from('planning_items').select('title, detail, status, amount, amount_kind').eq('topic_id', topic.id).order('created_at')) : [];
        data.honeymoon = {
          items: rows.map((r) => ({ title: r.title, detail: scrub(r.detail, f), status: r.status, amount: f.money && r.amount != null ? Number(r.amount) : null, kind: f.money ? r.amount_kind : null })),
        };
      }
    }

    // Keep the order the link was created with.
    return json({
      link: {
        label: link.label,
        access: link.access,
        sections: link.sections,
        show: f,
        expiresAt: link.expires_at,
        edit: { tasks: canEditTasks, rsvp: canEditRsvp },
      },
      data: cleanAll(data, f),
    });
  } catch (_e) {
    // Never leak internals to an anonymous caller.
    return json({ error: 'server_error' }, 500);
  }
});
