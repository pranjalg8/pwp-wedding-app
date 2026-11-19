// Reading a product page for the wishlist's "fill from link". No imports, so the web test suite can run these.
// Everything here is best effort: stores often hide the price or block robots, and the planner then asks for the
// details by hand. What is found is only ever offered to the person adding the item, never saved on its own.

export const MAX_HTML = 1_500_000; // bytes read from a page
export const MAX_HOPS = 4; // redirects followed (short links like amzn.to and fkrt.cc redirect)

// An address a public web page can never legitimately live at.
export function privateIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, '');
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if ([a, b, Number(v4[3]), Number(v4[4])].some((n) => n > 255)) return true;
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (v.includes(':')) {
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(v);
    if (mapped) return privateIp(mapped[1]);
    return v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || /^ff/.test(v);
  }
  return false;
}

const IP_LITERAL = /^(\d{1,3}\.){3}\d{1,3}$|:/;

// Only plain web addresses to public hosts. Returns the parsed address or why not.
export function checkFetchUrl(raw: string): { url: URL } | { error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: 'That does not look like a web address.' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { error: 'Only http and https addresses work.' };
  if (url.username || url.password) return { error: 'That address has a login in it.' };
  if (url.port && url.port !== '80' && url.port !== '443') return { error: 'That address uses an unusual port.' };
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.') && !IP_LITERAL.test(host)) {
    return { error: 'That address is not a public website.' };
  }
  if (IP_LITERAL.test(host) && privateIp(host)) return { error: 'That address is not a public website.' };
  return { url };
}

export function storeName(raw: string): string | null {
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
  const known: [RegExp, string][] = [
    [/(^|\.)amazon\.|(^|\.)amzn\./, 'Amazon'],
    [/(^|\.)flipkart\.com$|(^|\.)fkrt\./, 'Flipkart'],
    [/(^|\.)myntra\.com$/, 'Myntra'],
    [/(^|\.)ikea\./, 'IKEA'],
    [/(^|\.)pepperfry\.com$/, 'Pepperfry'],
    [/(^|\.)urbanladder\.com$/, 'Urban Ladder'],
    [/(^|\.)meesho\.com$/, 'Meesho'],
    [/(^|\.)croma\.com$/, 'Croma'],
    [/(^|\.)nykaa\.com$/, 'Nykaa'],
    [/(^|\.)ajio\.com$/, 'Ajio'],
    [/(^|\.)bigbasket\.com$/, 'BigBasket'],
    [/(^|\.)hometown\.in$/, 'HomeTown'],
    [/(^|\.)woodenstreet\.com$/, 'Wooden Street'],
  ];
  for (const [re, name] of known) if (re.test(host)) return name;
  return host || null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ndash: '–', mdash: '—' };
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
function safeChar(code: number) {
  return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
}

// The content of the first <meta> tag whose property, name or itemprop is one of `names` (any attribute order).
export function meta(html: string, names: string[]): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const name of names) {
    for (const tag of tags) {
      const key = /\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
      if (key !== name.toLowerCase()) continue;
      const content = /\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i.exec(tag);
      const value = (content?.[1] ?? content?.[2] ?? '').trim();
      if (value) return decodeEntities(value);
    }
  }
  return null;
}

// "₹1,299.00", "Rs. 1299", 1299 -> 1299 (whole rupees). Nothing usable -> null.
export function rupees(v: unknown): number | null {
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v : '';
  const m = /(\d[\d,]*(?:\.\d+)?)/.exec(s.replace(/\s/g, ''));
  if (!m) return null;
  const n = Math.round(Number(m[1].replace(/,/g, '')));
  return Number.isFinite(n) && n > 0 && n < 100_000_000 ? n : null;
}

// deno-lint-ignore no-explicit-any
type Json = any;

function* walk(node: Json): Generator<Json> {
  if (Array.isArray(node)) for (const n of node) yield* walk(n);
  else if (node && typeof node === 'object') {
    yield node;
    for (const v of Object.values(node)) if (v && typeof v === 'object') yield* walk(v);
  }
}

const list = (v: Json): Json[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const isProduct = (n: Json) => list(n?.['@type']).some((t) => /^Product$/i.test(String(t)));

function firstString(v: Json): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (Array.isArray(v)) for (const x of v) { const s = firstString(x); if (s) return s; }
  if (v && typeof v === 'object') return firstString(v.url ?? v.contentUrl);
  return null;
}

function offerPrices(offers: Json): { lo: number | null; hi: number | null } {
  let lo: number | null = null;
  let hi: number | null = null;
  for (const o of list(offers)) {
    const cur = String(o?.priceCurrency ?? 'INR').toUpperCase();
    if (cur !== 'INR') continue;
    for (const v of [o?.price, o?.lowPrice, o?.highPrice]) {
      const n = rupees(v);
      if (n == null) continue;
      lo = lo == null ? n : Math.min(lo, n);
      hi = hi == null ? n : Math.max(hi, n);
    }
  }
  return { lo, hi };
}

export type Found = { title: string | null; image: string | null; price_min: number | null; price_max: number | null };

// Light clean-up of store page titles: "Name : Amazon.in: Home & Kitchen" -> "Name".
export function cleanTitle(raw: string): string {
  let t = decodeEntities(raw).replace(/\s+/g, ' ').trim();
  t = t.replace(/\s*[:|–-]\s*(?:Amazon\.in|Flipkart\.com|Buy\b|Shop\b).*$/i, '').replace(/\s+(?:online at|at best price).*$/i, '');
  return t.slice(0, 160).trim();
}

export function parseProduct(html: string, pageUrl: string): Found {
  let title: string | null = null;
  let image: string | null = null;
  let lo: number | null = null;
  let hi: number | null = null;

  for (const block of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: Json;
    try {
      data = JSON.parse(block[1].trim());
    } catch {
      continue;
    }
    for (const node of walk(data)) {
      if (!isProduct(node)) continue;
      title ??= firstString(node.name);
      image ??= firstString(node.image);
      const p = offerPrices(node.offers);
      if (p.lo != null && lo == null) { lo = p.lo; hi = p.hi; }
    }
  }

  title ??= meta(html, ['og:title', 'twitter:title']);
  if (!title) {
    const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (t) title = decodeEntities(t[1]);
  }
  image ??= meta(html, ['og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src']);

  if (lo == null) {
    const currency = (meta(html, ['product:price:currency', 'og:price:currency', 'priceCurrency']) ?? 'INR').toUpperCase();
    const amount = currency === 'INR' ? rupees(meta(html, ['product:price:amount', 'og:price:amount', 'price'])) : null;
    if (amount != null) { lo = amount; hi = amount; }
  }

  let abs: string | null = null;
  if (image) {
    try {
      const u = new URL(decodeEntities(image), pageUrl);
      if (u.protocol === 'https:' || u.protocol === 'http:') abs = u.toString();
    } catch {
      abs = null;
    }
  }
  return { title: title ? cleanTitle(title) || null : null, image: abs, price_min: lo, price_max: hi };
}
