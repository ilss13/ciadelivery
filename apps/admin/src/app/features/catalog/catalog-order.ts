export function reorder<T extends { id: string; sortOrder: number }>(
  items: readonly T[],
  index: number,
  direction: -1 | 1,
): T[] | null {
  const target = index + direction;
  if (target < 0 || target >= items.length) {
    return null;
  }

  const next = [...items];
  const current = next[index];
  const neighbor = next[target];
  if (current === undefined || neighbor === undefined) {
    return null;
  }

  next[index] = neighbor;
  next[target] = current;
  return next.map((item, sortOrder) => ({ ...item, sortOrder }));
}
