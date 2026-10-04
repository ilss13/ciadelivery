import { expect, test, type Page } from '@playwright/test';

const STORES = [
  { host: 'pizzariadoze.localhost:4201' },
  { host: 'burgercentral.localhost:4201' },
] as const;

test('dois subdomínios mostram nome e cor primária diferentes', async ({
  page,
}) => {
  const brands = [];
  for (const store of STORES) {
    brands.push(await readBrand(page, store.host));
  }

  expect(brands[0]?.name).not.toBe(brands[1]?.name);
  expect(brands[0]?.name.length).toBeGreaterThan(0);
  expect(brands[1]?.name.length).toBeGreaterThan(0);
  expect(brands[0]?.primary.toLowerCase()).not.toBe(
    brands[1]?.primary.toLowerCase(),
  );
  expect(brands[0]?.primary.length).toBeGreaterThan(0);
  expect(brands[1]?.primary.length).toBeGreaterThan(0);
});

async function readBrand(
  page: Page,
  host: string,
): Promise<{ name: string; primary: string }> {
  const url = `http://${host}/`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Não foi possível abrir ${url}. Suba a API e o storefront antes do e2e: npm run start:api e npm run start:storefront. ${detail}`,
    );
  }

  try {
    await page.waitForFunction(
      () => !document.body.innerText.includes('Carregando a loja'),
      { timeout: 10_000 },
    );
  } catch {
    throw new Error(
      `A página ${url} não saiu do carregamento. A API em http://localhost:3000 parece fora do ar. Suba com npm run start:api (SEED_DEMO=true) e o storefront com npm run start:storefront.`,
    );
  }

  const unavailable = page.locator('main.unavailable h1');
  if ((await unavailable.count()) > 0) {
    const title = (await unavailable.first().textContent())?.trim() ?? '';
    throw new Error(
      `A loja em ${url} não abriu (${title}). A API precisa estar no ar com as lojas de demonstração. Rode npm run start:api com SEED_DEMO=true e npm run start:storefront.`,
    );
  }

  const name =
    (await page.locator('main.store h1').textContent())?.trim() ?? '';
  const primary = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--brand-primary')
      .trim(),
  );
  if (name.length === 0 || primary.length === 0) {
    throw new Error(
      `A loja em ${url} abriu sem nome ou sem --brand-primary. Confira se a API em http://localhost:3000 respondeu o branding. Comandos: npm run start:api e npm run start:storefront.`,
    );
  }

  return { name, primary };
}
