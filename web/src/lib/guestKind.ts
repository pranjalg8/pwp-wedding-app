// A guest household, the couple's own family, or staff (drivers, helpers). Lets meals and rooms be counted for each.
export type GuestKind = 'guest' | 'family' | 'staff';
export const KIND_LABEL: Record<GuestKind, string> = { guest: 'Guest', family: 'Family', staff: 'Staff' };
