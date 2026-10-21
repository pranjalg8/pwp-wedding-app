import { supabase } from './supabase';

// What a link can show, and which kinds of sensitive information each part needs.
export type SectionKey = 'home' | 'tasks' | 'functions' | 'guests' | 'rooms' | 'budget' | 'vendors' | 'honeymoon';
export type SensitiveKey = 'money' | 'guests' | 'honeymoon' | 'contacts';

export const SECTIONS: { key: SectionKey; label: string; hint: string; needs?: SensitiveKey }[] = [
  { key: 'home', label: 'Overview', hint: 'Days to go, what is due next, what needs a decision' },
  { key: 'tasks', label: 'Tasks', hint: 'Every task with its options and status' },
  { key: 'functions', label: 'Functions', hint: 'Each function with its date, theme and colours' },
  { key: 'guests', label: 'Guests', hint: 'RSVP totals by status and by day' },
  { key: 'rooms', label: 'Rooms', hint: 'Places, rooms per night and how many are placed' },
  { key: 'budget', label: 'Budget', hint: 'Payments made and due, and funds', needs: 'money' },
  { key: 'vendors', label: 'Vendors', hint: 'Everyone we are working with' },
  { key: 'honeymoon', label: 'Honeymoon', hint: 'The honeymoon plan', needs: 'honeymoon' },
];

export const SENSITIVE: { key: SensitiveKey; field: 'show_money' | 'show_guests' | 'show_honeymoon' | 'show_contacts'; label: string; warning: string }[] = [
  { key: 'money', field: 'show_money', label: 'Amounts and money', warning: 'Prices, quotes, payments due and funds. Needed for the Budget section.' },
  { key: 'guests', field: 'show_guests', label: 'Guest names and families', warning: 'Names of households and family members, where they live and their RSVP answers.' },
  { key: 'honeymoon', field: 'show_honeymoon', label: 'Honeymoon', warning: 'Where you are going and the plans. Needed for the Honeymoon section.' },
  { key: 'contacts', field: 'show_contacts', label: 'Phone numbers and emails', warning: 'Contact details of vendors and other people.' },
];

export type Sensitivity = Record<SensitiveKey, boolean>;
export const NO_SENSITIVE: Sensitivity = { money: false, guests: false, honeymoon: false, contacts: false };
export const ALL_SENSITIVE: Sensitivity = { money: true, guests: true, honeymoon: true, contacts: true };

export const PRESETS = {
  family: { label: 'Core family', hint: 'Everything, including money, guests and the honeymoon', sections: SECTIONS.map((s) => s.key), sensitive: ALL_SENSITIVE },
  planning: {
    label: 'Friends and vendors',
    hint: 'The plan only, with no money, guest names or contacts',
    sections: ['home', 'tasks', 'functions', 'rooms'] as SectionKey[],
    sensitive: NO_SENSITIVE,
  },
} as const;

export const MAX_TTL_DAYS = 3;

export type ShareLink = {
  id: string;
  label: string;
  access: 'view' | 'edit';
  sections: SectionKey[];
  show_money: boolean;
  show_guests: boolean;
  show_honeymoon: boolean;
  show_contacts: boolean;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  use_count: number;
};

export type LinkState = 'active' | 'expired' | 'revoked';
export const stateOf = (l: Pick<ShareLink, 'expires_at' | 'revoked_at'>, now = Date.now()): LinkState =>
  l.revoked_at ? 'revoked' : new Date(l.expires_at).getTime() <= now ? 'expired' : 'active';

export function sensitiveOf(l: Pick<ShareLink, 'show_money' | 'show_guests' | 'show_honeymoon' | 'show_contacts'>): SensitiveKey[] {
  return SENSITIVE.filter((s) => l[s.field]).map((s) => s.key);
}

// A long random secret. Only its hash is stored, so the link cannot be recovered later: it is shown once.
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export async function hashToken(token: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const linkUrl = (token: string) => `${window.location.origin}${import.meta.env.BASE_URL}#/s/${token}`;

export type NewLink = { label: string; sections: SectionKey[]; sensitive: Sensitivity; ttlDays: number };

export async function createShareLink(input: NewLink, createdBy: string | null) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  // The database stamps created_at itself and refuses an expiry more than 3 days after it, so leave two minutes of
  // room for a clock that runs a little ahead.
  const expiresAt = new Date(Date.now() + Math.min(input.ttlDays, MAX_TTL_DAYS) * 86_400_000 - 2 * 60_000).toISOString();
  const { error } = await supabase.from('share_links').insert({
    token_hash: await hashToken(token),
    label: input.label.trim(),
    access: 'view',
    sections: input.sections,
    show_money: input.sensitive.money,
    show_guests: input.sensitive.guests,
    show_honeymoon: input.sensitive.honeymoon,
    show_contacts: input.sensitive.contacts,
    created_by: createdBy,
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);
  return { url: linkUrl(token), expiresAt };
}

export async function listShareLinks(): Promise<ShareLink[]> {
  const { data, error } = await supabase
    .from('share_links')
    .select('id, label, access, sections, show_money, show_guests, show_honeymoon, show_contacts, created_at, expires_at, revoked_at, last_used_at, use_count')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ShareLink[];
}

export async function revokeShareLink(id: string) {
  const { error } = await supabase.from('share_links').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

// "in 2 days 3 hours", "in 40 minutes" for the time left.
export function timeLeft(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'expired';
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days} day${days === 1 ? '' : 's'}${hours > 0 ? ` ${hours} h` : ''} left`;
  if (hours > 0) return `${hours} h ${mins % 60} min left`;
  return `${Math.max(1, mins)} min left`;
}
