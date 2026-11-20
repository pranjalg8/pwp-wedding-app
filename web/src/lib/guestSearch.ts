// Guest list search: one lowercased blob of contact text per household, built once, so a keystroke is a
// single substring check per guest instead of a scan of every contact.
type ContactLike = { guest_id: string; person: string; value: string };
type GuestLike = { id: string; name: string; family_members?: string | null; location?: string | null; relation?: string | null };

export function contactTextByGuest(contacts: ContactLike[]): Map<string, string> {
  const parts = new Map<string, string[]>();
  for (const c of contacts) {
    const list = parts.get(c.guest_id) ?? [];
    list.push(c.value.toLowerCase(), c.person.toLowerCase());
    parts.set(c.guest_id, list);
  }
  // A newline cannot appear in a typed query, so a match cannot straddle two contacts.
  return new Map([...parts].map(([id, list]) => [id, list.join('\n')]));
}

// q must already be trimmed and lowercased; an empty query matches everyone.
export function guestMatches(g: GuestLike, q: string, contactText: Map<string, string>): boolean {
  if (!q) return true;
  if ([g.name, g.family_members, g.location, g.relation].some((v) => v?.toLowerCase().includes(q))) return true;
  return contactText.get(g.id)?.includes(q) ?? false;
}
