import type { Scheduled } from './budgetPlan';
import type { StayNight } from './stay';
import type { Occupant, StayRoom } from './rooms';

// People sleeping at each place on each night, from the room board. The key is "site|night".
export function peopleByNight(rooms: Pick<StayRoom, 'id' | 'site_id'>[], occ: Map<string, Pick<Occupant, 'people' | 'nights'>[]>) {
  const out = new Map<string, number>();
  for (const r of rooms) {
    for (const o of occ.get(r.id) ?? []) {
      for (const n of o.nights) out.set(`${r.site_id}|${n}`, (out.get(`${r.site_id}|${n}`) ?? 0) + o.people);
    }
  }
  return out;
}

// boardPeople is null until every household that needs a room has one: a half-filled board would understate the meals.
export type PlanCounts = { nights: Pick<StayNight, 'site_id' | 'night' | 'rooms'>[]; boardPeople: Map<string, number> | null };

// The quantity the plan gives for a line, or null when the plan cannot say yet.
export function plannedQuantity(line: Scheduled, counts: PlanCounts) {
  if (!line.basis || !line.basis_site_id) return null;
  const times = line.basis_multiplier ?? 1;
  const extra = line.basis_extra ?? 0;
  if (line.basis === 'room_nights') {
    const mine = counts.nights.filter((n) => n.site_id === line.basis_site_id);
    if (mine.length === 0) return null;
    return mine.reduce((a, n) => a + n.rooms, 0) * times + extra;
  }
  if (!counts.boardPeople || !line.basis_night) return null;
  return (counts.boardPeople.get(`${line.basis_site_id}|${line.basis_night}`) ?? 0) * times + extra;
}

export type PlanChange = { line: Scheduled; quantity: number; amount: number; difference: number };

// Pending lines whose amount no longer matches the plan.
export function planChanges(lines: Scheduled[], counts: PlanCounts): PlanChange[] {
  const out: PlanChange[] = [];
  for (const line of lines) {
    if (line.status !== 'pending' || line.rate == null) continue;
    const quantity = plannedQuantity(line, counts);
    if (quantity === null) continue;
    const amount = Math.max(0, Math.round(quantity * line.rate + (line.adjustment ?? 0)));
    if (Math.abs(amount - line.amount) >= 1) out.push({ line, quantity, amount, difference: amount - line.amount });
  }
  return out;
}
