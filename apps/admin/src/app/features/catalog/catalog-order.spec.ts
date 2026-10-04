import { reorder } from './catalog-order';

describe('reorder', () => {
  it('swaps neighbors and rewrites sort order', () => {
    const items = [
      { id: 'a', sortOrder: 0, name: 'A' },
      { id: 'b', sortOrder: 1, name: 'B' },
    ];

    expect(reorder(items, 1, -1)).toEqual([
      { id: 'b', sortOrder: 0, name: 'B' },
      { id: 'a', sortOrder: 1, name: 'A' },
    ]);
  });

  it('ignores a move past the ends', () => {
    const items = [{ id: 'a', sortOrder: 0 }];
    expect(reorder(items, 0, -1)).toBeNull();
  });
});
