// The checks behind the wishlist function. No imports, so the web test suite can run them.

export const PER_IP_READ = 120; // page loads an hour
export const PER_IP_WRITE = 20; // claims and undos an hour
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The secret a friend's phone makes for each claim; only its hash is stored.
export const TOKEN = /^[A-Za-z0-9_-]{24,80}$/;

export const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// The visitor's address for the hourly limit. cf-connecting-ip is set by the platform's proxy; x-forwarded-for can
// start with whatever the caller sent, so it is only the fallback, and then its last entry is the one a proxy added.
export function clientIp(headers: { get(name: string): string | null }) {
  const direct = headers.get('cf-connecting-ip')?.trim();
  if (direct) return direct;
  const chain = (headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return chain[chain.length - 1] ?? 'unknown';
}

export type ClaimRequest = { id: string; name: string; token: string };

export function checkClaim(body: Record<string, unknown>): { claim: ClaimRequest } | { error: string } {
  const name = text(body.name, 60);
  if (!name) return { error: 'Please tell us your name.' };
  if (typeof body.id !== 'string' || !UUID.test(body.id)) return { error: 'Please pick a gift from the list.' };
  if (typeof body.token !== 'string' || !TOKEN.test(body.token)) return { error: 'Please try again.' };
  return { claim: { id: body.id.toLowerCase(), name, token: body.token } };
}

export function checkUnclaim(body: Record<string, unknown>): { undo: { id: string; token: string } } | { error: string } {
  if (typeof body.id !== 'string' || !UUID.test(body.id)) return { error: 'Please pick a gift from the list.' };
  if (typeof body.token !== 'string' || !TOKEN.test(body.token)) return { error: 'Please try again.' };
  return { undo: { id: body.id.toLowerCase(), token: body.token } };
}

type ItemRow = {
  id: string;
  title: string;
  note: string | null;
  category: string;
  url: string | null;
  image_url: string | null;
  price_min: number | null;
  price_max: number | null;
  quantity: number;
};

// What a friend sees of an item. Only these fields, and how many places are left, never who took them.
export function publicItem(row: ItemRow, claimed: number) {
  const left = Math.max(0, row.quantity - claimed);
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    category: row.category,
    url: row.url,
    image_url: row.image_url,
    price_min: row.price_min,
    price_max: row.price_max,
    quantity: row.quantity,
    left,
  };
}
