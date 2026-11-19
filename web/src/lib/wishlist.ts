import { storeName } from '../../../supabase/functions/wishlist-fetch/parse';

// The gift wishlist: what we need for the new home, and what friends can pick from.

export type WishItem = {
  id: string;
  title: string;
  note: string | null;
  category: string;
  url: string | null;
  image_url: string | null;
  price_min: number | null;
  price_max: number | null;
  quantity: number;
  hidden: boolean;
  sort_order: number;
  created_at: string;
};

export type WishClaim = { id: string; item_id: string; name: string; created_at: string };

// What a friend gets back: no hidden flag, and how many places are left instead of who took them.
export type PublicItem = Pick<WishItem, 'id' | 'title' | 'note' | 'category' | 'url' | 'image_url' | 'price_min' | 'price_max' | 'quantity'> & { left: number };

export const CATEGORIES = ['Kitchen', 'Dining', 'Living room', 'Bedroom', 'Bath', 'Appliances', 'Decor', 'Cleaning', 'Other'];

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

// "₹1,200 – ₹1,500", "₹1,200", or nothing when no price is known.
export function formatPrice(min: number | null, max: number | null): string {
  if (min == null && max == null) return '';
  if (min == null || max == null || min === max) return inr((min ?? max) as number);
  return `${inr(min)} – ${inr(max)}`;
}

// Whole rupees from what a person types: "1,200", "₹1200", " 1 200 ". Blank or nonsense gives null.
export function parsePrice(s: string): number | null {
  const digits = s.replace(/[^\d.]/g, '');
  if (!digits) return null;
  const n = Math.round(Number(digits));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export const BUDGETS = [
  { key: 'all', label: 'Any budget', min: 0, max: Infinity },
  { key: 'u1', label: 'Under ₹1,000', min: 0, max: 999 },
  { key: 'u5', label: '₹1,000 – ₹5,000', min: 1000, max: 5000 },
  { key: 'u15', label: '₹5,000 – ₹15,000', min: 5001, max: 15000 },
  { key: 'o15', label: 'Above ₹15,000', min: 15001, max: Infinity },
] as const;
export type BudgetKey = (typeof BUDGETS)[number]['key'];

// An item fits a budget band when its price range touches the band. An item with no price fits every band.
export function fitsBudget(item: Pick<PublicItem, 'price_min' | 'price_max'>, key: BudgetKey): boolean {
  const band = BUDGETS.find((b) => b.key === key) ?? BUDGETS[0];
  if (band.key === 'all') return true;
  const lo = item.price_min ?? item.price_max;
  const hi = item.price_max ?? item.price_min;
  if (lo == null || hi == null) return true;
  return lo <= band.max && hi >= band.min;
}

// "Amazon", "Flipkart" or the site's name, for the badge and the button.
export const storeOf = (url: string | null): string | null => (url ? storeName(url) : null);

export const isWebAddress = (s: string) => /^https?:\/\/[^\s]{1,2000}$/i.test(s.trim());

export const wishlistUrl = () => `${window.location.origin}${import.meta.env.BASE_URL}#/gifts`;

// ----- Friends' side: what this phone has taken -------------------------------------------------------------
// Each claim has a secret the phone invents. It is kept here so the same phone can undo the claim later.
const CLAIMS_KEY = 'pwp-wishlist-claims';

export function newSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function myClaims(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(CLAIMS_KEY) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function rememberClaim(itemId: string, secret: string) {
  try {
    localStorage.setItem(CLAIMS_KEY, JSON.stringify({ ...myClaims(), [itemId]: secret }));
  } catch {
    // storage unavailable: the claim still counts, it just cannot be undone from this phone
  }
}

export function forgetClaim(itemId: string) {
  try {
    const rest = { ...myClaims() };
    delete rest[itemId];
    localStorage.setItem(CLAIMS_KEY, JSON.stringify(rest));
  } catch {
    // nothing to forget
  }
}

const endpoint = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wishlist`;

export type PublicList = { open: false } | { open: true; items: PublicItem[] };

export async function loadPublicList(): Promise<PublicList> {
  const res = await fetch(endpoint());
  if (!res.ok) throw new Error(res.status === 429 ? 'busy' : 'unavailable');
  return (await res.json()) as PublicList;
}

export async function claimGift(id: string, name: string, website = ''): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = newSecret();
  return post({ action: 'claim', id, name, token, website }, () => rememberClaim(id, token));
}

export async function unclaimGift(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = myClaims()[id];
  if (!token) return { ok: false, error: 'This gift was marked from another phone, so it can only be undone from there.' };
  return post({ action: 'unclaim', id, token }, () => forgetClaim(id));
}

async function post(body: Record<string, unknown>, onOk: () => void): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(endpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? 'Something went wrong. Please try again.' };
    onOk();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the list. Please check your connection and try again.' };
  }
}

// ----- Planner side: a picture from a phone or computer -----------------------------------------------------
// Shrinks a photo to at most 900 pixels on its longer side and saves it as a JPEG, so uploads stay small.
export async function shrinkPicture(file: File, maxSide = 900): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot resize pictures.');
  ctx.fillStyle = '#fff'; // transparent pictures get a white background in a JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not resize the picture.'))), 'image/jpeg', 0.85));
}
