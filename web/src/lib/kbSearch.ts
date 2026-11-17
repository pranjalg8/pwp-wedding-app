// Plain keyword search over the knowledge base. It is what the Ask panel falls back to when the AI answer is not
// available (no Gemini key set, rate limit, offline), and it is also handy as a quick "where is this written" lookup.

export type KbPage = { slug: string; title: string; body: string };
export type KbHit = { slug: string; title: string; heading: string; line: string; score: number };

const STOP = new Set(
  ('a an and are as at be by can do does for from has have how i in is it its me my of on or our so than that the their ' +
    'there this to us was we what when where which who whom why will with would you your tell about kitna kya hai').split(' '),
);

export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}₹]+/gu) ?? []).filter((t) => t.length > 1 && !STOP.has(t));
}

// A word matches if either is a prefix of the other, so "rooms" finds "room" and "photographer" finds "photographers".
function matches(word: string, token: string): boolean {
  if (word === token) return true;
  const min = Math.min(word.length, token.length);
  return min >= 4 && (word.startsWith(token) || token.startsWith(word));
}

// The pages an AI answer names in square brackets, e.g. "... [Budget]" or "[Budget, Stay and food]".
export function sourcesIn(pages: KbPage[], answer: string): { slug: string; title: string }[] {
  const named = [...answer.matchAll(/\[([^\]]+)\]/g)].flatMap((m) => m[1].split(/[,;]/).map((s) => s.trim().toLowerCase()));
  return pages.filter((p) => named.includes(p.title.toLowerCase())).map((p) => ({ slug: p.slug, title: p.title }));
}

export function searchKb(pages: KbPage[], question: string, limit = 6): KbHit[] {
  const q = tokens(question);
  if (!q.length) return [];
  const hits: KbHit[] = [];
  for (const page of pages) {
    let heading = page.title;
    for (const raw of page.body.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const h = /^#{1,3}\s+(.*)$/.exec(line);
      if (h) {
        heading = h[1];
        continue;
      }
      const words = tokens(line);
      const inHeading = tokens(heading + ' ' + page.title);
      let score = 0;
      for (const t of q) {
        if (words.some((w) => matches(w, t))) score += 2;
        else if (inHeading.some((w) => matches(w, t))) score += 1;
      }
      // A line has to answer most of the question, not just share one common word.
      if (score >= Math.max(2, Math.ceil(q.length * 0.8))) {
        hits.push({ slug: page.slug, title: page.title, heading, line: line.replace(/^[-*]\s+/, ''), score });
      }
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
