/** Supabase applies a server row cap; enumerate explicit stable pages to avoid silent data loss. */
export async function collectPages<T>(fetchPage: (from: number, to: number) => Promise<T[]>, pageSize = 500): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const rows = await fetchPage(from, from + pageSize - 1);
    all.push(...rows);
    if (rows.length < pageSize) return all;
  }
}
