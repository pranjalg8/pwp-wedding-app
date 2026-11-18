// PostgREST caps a response at 1000 rows. For tables that can grow past that and where the page needs every row,
// page through with .range() until a short page comes back. The factory must apply a stable .order().
type Page<T> = { data: T[] | null; error: { message: string } | null };

export const PAGE_SIZE = 1000;

export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<Page<T>>, pageSize = PAGE_SIZE): Promise<Page<T>> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { data: null, error };
    const got = data ?? [];
    rows.push(...got);
    if (got.length < pageSize) return { data: rows, error: null };
  }
}
