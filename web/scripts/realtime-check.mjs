// Checks that every table the app subscribes to for live updates is in the supabase_realtime publication, as built
// up by the migrations. A subscription to a table that is not published never fires and gives no error, so this
// catches it before merging. Run: npm run realtime:check
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const migrationsDir = path.resolve(root, '../supabase/migrations');

// Replay the publication from the migrations, in filename order. Handles the plain statements and the
// array-loop form used in 0041.
const published = new Set();
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  const sql = readFileSync(path.join(migrationsDir, file), 'utf8').replace(/--.*$/gm, '');
  for (const m of sql.matchAll(/alter\s+publication\s+supabase_realtime\s+(add|drop)\s+table\s+([^;]+);/gi)) {
    const tables = m[2].split(',').map((t) => t.trim().replace(/^public\./, '').replace(/"/g, ''));
    for (const t of tables) {
      if (t.includes('%')) continue; // format() template, handled below
      if (m[1].toLowerCase() === 'add') published.add(t);
      else published.delete(t);
    }
  }
  const loop = sql.match(/foreach\s+\w+\s+in\s+array\s+array\[([^\]]+)\]\s+loop[\s\S]*?add\s+table/i);
  if (loop) for (const t of loop[1].split(',')) published.add(t.trim().replace(/'/g, ''));
}

// Every `table: '<name>'` inside a postgres_changes subscription in the app.
const subscribed = new Map();
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) {
      const src = readFileSync(p, 'utf8');
      for (const m of src.matchAll(/postgres_changes'[^}]*table:\s*'([a-z_]+)'/g)) {
        const list = subscribed.get(m[1]) ?? [];
        list.push(path.relative(root, p));
        subscribed.set(m[1], list);
      }
    }
  }
}
walk(path.join(root, 'src'));

const missing = [...subscribed.entries()].filter(([t]) => !published.has(t));
if (missing.length) {
  console.error('These tables are subscribed to but not in the supabase_realtime publication:');
  for (const [t, files] of missing) console.error(`  ${t}  (${[...new Set(files)].join(', ')})`);
  console.error('Add them in a new migration with: alter publication supabase_realtime add table <name>;');
  process.exit(1);
}
console.log(`Realtime check passed: ${subscribed.size} subscribed tables, all published.`);
