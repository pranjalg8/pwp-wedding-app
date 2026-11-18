import { supabase, type Topic } from './supabase';
import { createAsyncCache } from './asyncCache';

export type TopicRow = Topic & { budget_group?: string | null };

// The topics list barely changes but half the pages need it: share one copy. The topics table is not in the
// realtime publication, so the copy is refreshed after a few minutes, and invalidateTopics() drops it at once
// (call it after editing a topic).
const cache = createAsyncCache(
  async () => {
    const { data, error } = await supabase.from('topics').select('*').order('sort_order');
    if (error) throw new Error(error.message);
    return (data ?? []) as TopicRow[];
  },
  { maxAgeMs: 5 * 60_000 }
);

// Same shape as a supabase response so callers keep their error handling.
export async function getTopics(): Promise<{ data: TopicRow[] | null; error: { message: string } | null }> {
  try {
    return { data: await cache.get(), error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

export const invalidateTopics = () => cache.invalidate();
