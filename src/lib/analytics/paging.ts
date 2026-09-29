// PostgREST caps every response at max_rows (1000, supabase/config.toml), so a
// full read has to walk .range() pages until one comes back short.
export const PAGE_SIZE = 1000;

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}
