import { expect, test, type Page } from '@playwright/test';

test('adiciona Calabresa com tamanho e adicional e mostra o valor no carrinho', async ({
  page,
}) => {
  await openStore(page);

  await page.getByRole('button', { name: /Calabresa/ }).click();
  await page.getByRole('radio', { name: /Grande/ }).check();
  await page.getByRole('checkbox', { name: /Borda/ }).check();
  await page.getByRole('button', { name: 'Adicionar' }).click();

  const cart = page.getByRole('region', { name: 'Carrinho' });
  await expect(cart.getByText('Borda', { exact: true })).toBeVisible();
  await expect(cart.locator('p.price')).toHaveText('R$ 67,90');
  await expect(page.getByRole('heading', { name: 'Pizzas' })).toBeVisible();
});

async function openStore(page: Page): Promise<void> {
  const url = 'http://pizzariadoze.localhost:4201/';
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
      `A página ${url} não saiu do carregamento. A API em http://localhost:3000 precisa estar no ar com SEED_DEMO=true.`,
    );
  }

  await expect(page.getByRole('button', { name: /Calabresa/ })).toBeVisible({
    timeout: 10_000,
  });
}
