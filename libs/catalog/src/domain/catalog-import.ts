export const CATALOG_IMPORT_HEADER = [
  'category',
  'product',
  'description',
  'price',
  'sku',
  'option_group',
  'option_name',
  'option_price',
  'option_min',
  'option_max',
] as const;

export interface CatalogImportError {
  line: number;
  code: string;
  message: string;
}

export interface ImportedOption {
  name: string;
  priceCents: number;
}

export interface ImportedOptionGroup {
  name: string;
  minSelect: number;
  maxSelect: number;
  options: ImportedOption[];
}

export interface ImportedProduct {
  name: string;
  description: string | null;
  priceCents: number;
  sku: string | null;
  optionGroups: ImportedOptionGroup[];
}

export interface ImportedCategory {
  name: string;
  products: ImportedProduct[];
}

export interface CatalogImportPlan {
  categories: ImportedCategory[];
  rowCount: number;
}

export type CatalogImportParseResult =
  | { ok: true; plan: CatalogImportPlan }
  | { ok: false; errors: CatalogImportError[] };

const MAX_ROWS = 500;
const MAX_PRICE_CENTS = 2147483647;

export function parseCatalogCsv(content: string): CatalogImportParseResult {
  const parsed = parseCsv(content.replace(/^\uFEFF/, ''));
  if (!parsed.ok) {
    return parsed;
  }
  const [header, ...rows] = parsed.rows;
  if (
    header === undefined ||
    header.values.length !== CATALOG_IMPORT_HEADER.length ||
    header.values.some(
      (value, index) => value.trim() !== CATALOG_IMPORT_HEADER[index],
    )
  ) {
    return failure(1, 'CSV_INVALID_HEADER', 'The CSV header is invalid');
  }

  const dataRows = rows.filter(({ values }) =>
    values.some((value) => value.trim().length > 0),
  );
  if (dataRows.length > MAX_ROWS) {
    return failure(
      MAX_ROWS + 2,
      'CSV_TOO_MANY_ROWS',
      'The CSV cannot contain more than 500 rows',
    );
  }

  const errors: CatalogImportError[] = [];
  const categories = new Map<string, ImportedCategory>();
  for (const row of dataRows) {
    if (row.values.length !== CATALOG_IMPORT_HEADER.length) {
      errors.push(lineError(row.line, 'CSV_INVALID_COLUMNS', 'The row must have 10 columns'));
      continue;
    }
    validateAndAdd(row.line, row.values.map((value) => value.trim()), categories, errors);
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    plan: { categories: [...categories.values()], rowCount: dataRows.length },
  };
}

interface CsvRow {
  line: number;
  values: string[];
}

type CsvParseResult =
  | { ok: true; rows: CsvRow[] }
  | { ok: false; errors: CatalogImportError[] };

function parseCsv(content: string): CsvParseResult {
  const rows: CsvRow[] = [];
  let values: string[] = [];
  let value = '';
  let quoted = false;
  let rowLine = 1;
  let line = 1;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (quoted) {
      if (char === '"' && content[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
        if (char === '\n') {
          line += 1;
        }
      }
      continue;
    }
    if (char === '"' && value.length === 0) {
      quoted = true;
    } else if (char === ',') {
      values.push(value);
      value = '';
    } else if (char === '\n') {
      values.push(value.replace(/\r$/, ''));
      rows.push({ line: rowLine, values });
      values = [];
      value = '';
      line += 1;
      rowLine = line;
    } else {
      value += char;
    }
  }
  if (quoted) {
    return failure(rowLine, 'CSV_MALFORMED', 'The CSV contains an unclosed quoted field');
  }
  if (value.length > 0 || values.length > 0) {
    values.push(value.replace(/\r$/, ''));
    rows.push({ line: rowLine, values });
  }
  return { ok: true, rows };
}

function validateAndAdd(
  line: number,
  values: string[],
  categories: Map<string, ImportedCategory>,
  errors: CatalogImportError[],
): void {
  const [
    categoryName,
    productName,
    description,
    price,
    sku,
    groupName,
    optionName,
    optionPrice,
    optionMin,
    optionMax,
  ] = values as [string, string, string, string, string, string, string, string, string, string];

  const priceCents = parseMoney(price);
  if (categoryName.length === 0) {
    errors.push(lineError(line, 'CATEGORY_REQUIRED', 'Category is required'));
  }
  if (productName.length === 0) {
    errors.push(lineError(line, 'PRODUCT_REQUIRED', 'Product is required'));
  }
  if (priceCents === null) {
    errors.push(lineError(line, 'INVALID_PRICE', 'Price must be a valid amount'));
  }
  if (categoryName.length === 0 || productName.length === 0 || priceCents === null) {
    return;
  }

  let minSelect = 0;
  let maxSelect = 0;
  let optionPriceCents = 0;
  if (groupName.length === 0) {
    if ([optionName, optionPrice, optionMin, optionMax].some((item) => item.length > 0)) {
      errors.push(
        lineError(
          line,
          'OPTION_GROUP_REQUIRED',
          'Option fields require an option group',
        ),
      );
      return;
    }
  } else {
    optionPriceCents = parseMoney(optionPrice) ?? -1;
    minSelect = parseInteger(optionMin);
    maxSelect = parseInteger(optionMax);
    if (optionName.length === 0) {
      errors.push(lineError(line, 'OPTION_REQUIRED', 'Option name is required'));
    }
    if (optionPriceCents < 0) {
      errors.push(
        lineError(line, 'INVALID_OPTION_PRICE', 'Option price must be a valid amount'),
      );
    }
    if (minSelect < 0 || maxSelect < 1 || minSelect > maxSelect) {
      errors.push(
        lineError(
          line,
          'INVALID_OPTION_GROUP',
          'Option minimum and maximum are invalid',
        ),
      );
    }
    if (optionName.length === 0 || optionPriceCents < 0 || minSelect < 0 || maxSelect < 1 || minSelect > maxSelect) {
      return;
    }
  }

  let category = categories.get(categoryName);
  if (category === undefined) {
    category = { name: categoryName, products: [] };
    categories.set(categoryName, category);
  }
  let product = category.products.find((item) => item.name === productName);
  if (product === undefined) {
    product = {
      name: productName,
      description: description.length === 0 ? null : description,
      priceCents,
      sku: sku.length === 0 ? null : sku,
      optionGroups: [],
    };
    category.products.push(product);
  } else if (
    product.priceCents !== priceCents ||
    product.description !== (description.length === 0 ? null : description) ||
    product.sku !== (sku.length === 0 ? null : sku)
  ) {
    errors.push(
      lineError(
        line,
        'PRODUCT_CONFLICT',
        'Repeated product rows must use the same product data',
      ),
    );
    return;
  }

  if (groupName.length === 0) {
    return;
  }
  let group = product.optionGroups.find((item) => item.name === groupName);
  if (group === undefined) {
    group = { name: groupName, minSelect, maxSelect, options: [] };
    product.optionGroups.push(group);
  } else if (group.minSelect !== minSelect || group.maxSelect !== maxSelect) {
    errors.push(
      lineError(
        line,
        'OPTION_GROUP_CONFLICT',
        'Repeated option groups must use the same minimum and maximum',
      ),
    );
    return;
  }
  const existingOption = group.options.find((item) => item.name === optionName);
  if (existingOption !== undefined) {
    if (existingOption.priceCents !== optionPriceCents) {
      errors.push(
        lineError(
          line,
          'OPTION_CONFLICT',
          'Repeated options must use the same price',
        ),
      );
    }
    return;
  }
  group.options.push({ name: optionName, priceCents: optionPriceCents });
}

function parseMoney(value: string): number | null {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) {
    return null;
  }
  const [reais, decimals = ''] = value.replace(',', '.').split('.');
  const cents = Number(reais) * 100 + Number(decimals.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= MAX_PRICE_CENTS ? cents : null;
}

function parseInteger(value: string): number {
  return /^\d+$/.test(value) ? Number(value) : -1;
}

function lineError(line: number, code: string, message: string): CatalogImportError {
  return { line, code, message };
}

function failure(
  line: number,
  code: string,
  message: string,
): { ok: false; errors: CatalogImportError[] } {
  return { ok: false, errors: [lineError(line, code, message)] };
}
