// Transport board: who arrives on which day, how many need a lift, and a rough vehicle count. Pure.
export type TransportGuest = { id: string; name: string; persons: number; needs_lift: boolean; arrive_on: string | null };
export type TravelNote = { guest_id: string; travel: string | null };

export type ArrivalDay = {
  date: string;
  households: { id: string; name: string; persons: number; needsLift: boolean; travel: string | null }[];
  people: number;
  liftPeople: number;
  vehicles: number;
};

export function arrivalsByDay(guests: TransportGuest[], notes: TravelNote[], seatsPerVehicle = 4): { days: ArrivalDay[]; undated: number } {
  const note = new Map(notes.filter((n) => n.travel && n.travel.trim()).map((n) => [n.guest_id, n.travel!.trim()]));
  const seats = Math.max(1, Math.floor(seatsPerVehicle) || 1);
  const byDate = new Map<string, ArrivalDay>();
  let undated = 0;
  for (const g of guests) {
    if (!g.arrive_on) {
      undated += 1;
      continue;
    }
    const day = byDate.get(g.arrive_on) ?? { date: g.arrive_on, households: [], people: 0, liftPeople: 0, vehicles: 0 };
    day.households.push({ id: g.id, name: g.name, persons: g.persons, needsLift: g.needs_lift, travel: note.get(g.id) ?? null });
    day.people += g.persons;
    if (g.needs_lift) day.liftPeople += g.persons;
    byDate.set(g.arrive_on, day);
  }
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of days) {
    d.vehicles = Math.ceil(d.liftPeople / seats);
    d.households.sort((a, b) => Number(b.needsLift) - Number(a.needsLift) || a.name.localeCompare(b.name));
  }
  return { days, undated };
}
