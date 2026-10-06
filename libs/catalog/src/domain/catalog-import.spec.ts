import { CATALOG_IMPORT_HEADER, parseCatalogCsv } from './catalog-import';

const header = CATALOG_IMPORT_HEADER.join(',');

describe('parseCatalogCsv', () => {
  it('groups repeated products and converts BRL values to cents', () => {
    const result = parseCatalogCsv(
      [
        header,
        'Pizzas,Calabresa,Clássica,"49,90",CAL,Tamanho,Média,"0,00",1,1',
        'Pizzas,Calabresa,Clássica,"49,90",CAL,Tamanho,Grande,10.00,1,1',
      ].join('\n'),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.plan.categories[0]?.products[0]).toMatchObject({
      name: 'Calabresa',
      priceCents: 4990,
      optionGroups: [
        {
          name: 'Tamanho',
          minSelect: 1,
          maxSelect: 1,
          options: [
            { name: 'Média', priceCents: 0 },
            { name: 'Grande', priceCents: 1000 },
          ],
        },
      ],
    });
  });

  it('reports an empty product price with its source line', () => {
    const result = parseCatalogCsv(
      [header, 'Pizzas,Calabresa,Clássica,,CAL,,,,,'].join('\n'),
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        { line: 2, code: 'INVALID_PRICE', message: 'Price must be a valid amount' },
      ],
    });
  });

  it('accepts a product without option groups', () => {
    const result = parseCatalogCsv(
      [header, 'Bebidas,Água,Sem gás,5.00,AGUA,,,,,'].join('\n'),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.categories[0]?.products[0]?.optionGroups).toEqual([]);
    }
  });
});
