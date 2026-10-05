import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test';

const demoPassword = 'DemoOwner123';

test.use({ viewport: { width: 360, height: 800 } });

test('faz o checkout da pizzaria até o acompanhamento', async ({ page }) => {
  const api = await playwrightRequest.newContext({
    baseURL: 'http://localhost:3000',
  });
  const restore = await openDemoStore(api);
  try {
    await openStore(page);
    await page.getByRole('button', { name: /Calabresa/ }).click();
    await page.getByRole('radio', { name: /Grande/ }).check();
    await page.getByRole('checkbox', { name: /Borda/ }).check();
    await page.getByRole('button', { name: 'Adicionar' }).click();
    await page.getByRole('button', { name: /Carrinho/ }).click();
    await page.getByRole('button', { name: 'Validar carrinho' }).click();
    await expect(page.getByText('Carrinho válido para esta loja.')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar carrinho' }).click();

    await page.getByLabel('Nome').fill('Ana');
    await page.getByLabel('Telefone').fill('11988887777');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('radio', { name: 'Entrega' }).check();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Rua').fill('Rua A');
    await page.getByLabel('Número').fill('10');
    await page.getByLabel('Bairro').fill('Centro');
    await page.getByLabel('Cidade').fill('São Paulo');
    await page.getByLabel('Estado').fill('SP');
    await page.getByLabel('CEP').fill('01001000');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('radio', { name: 'Dinheiro' }).check();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByText(/Taxa de entrega/)).toBeVisible();
    await page.getByRole('checkbox', { name: /Autorizo o uso/ }).check();
    await page.getByRole('button', { name: 'Fazer pedido' }).click();

    await expect(page).toHaveURL(/\/pedido\//);
    await expect(page.getByRole('status')).toHaveText('Pedido realizado');
  } finally {
    await restore();
    await api.dispose();
  }
});

async function openDemoStore(api: APIRequestContext): Promise<() => Promise<void>> {
  const login = await api.post('/api/v1/auth/login', {
    data: {
      email: 'pizzariadoze-owner@example.com',
      password: demoPassword,
    },
  });
  if (!login.ok()) {
    throw new Error(
      'Não foi possível entrar como a pizzaria de demonstração. Suba a API com SEED_DEMO=true.',
    );
  }
  const token = ((await login.json()) as { accessToken: string }).accessToken;
  const headers = { Authorization: `Bearer ${token}` };
  const storeResponse = await api.get('/api/v1/admin/store', { headers });
  const hoursResponse = await api.get('/api/v1/admin/store/hours', { headers });
  if (!storeResponse.ok() || !hoursResponse.ok()) {
    throw new Error('Não foi possível ler a loja de demonstração.');
  }
  const store = (await storeResponse.json()) as {
    name: string;
    phone: string;
    address: unknown;
    minimumOrderCents: number;
    isManuallyClosed: boolean;
  };
  const hours = (await hoursResponse.json()) as { hours: unknown };
  const opened = await api.put('/api/v1/admin/store', {
    headers,
    data: {
      name: store.name,
      phone: store.phone,
      address: store.address,
      minimumOrderCents: 0,
      isManuallyClosed: false,
    },
  });
  const week = await api.put('/api/v1/admin/store/hours', {
    headers,
    data: {
      hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        opensAt: '00:00:00',
        closesAt: '23:59:59',
        closed: false,
      })),
    },
  });
  if (!opened.ok() || !week.ok()) {
    throw new Error('Não foi possível abrir a pizzaria de demonstração para o checkout.');
  }

  return async () => {
    await api.put('/api/v1/admin/store', {
      headers,
      data: {
        name: store.name,
        phone: store.phone,
        address: store.address,
        minimumOrderCents: store.minimumOrderCents,
        isManuallyClosed: store.isManuallyClosed,
      },
    });
    await api.put('/api/v1/admin/store/hours', { headers, data: hours });
  };
}

async function openStore(page: Page): Promise<void> {
  const url = 'http://pizzariadoze.localhost:4201/';
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Não foi possível abrir ${url}. Suba a API e o storefront antes do e2e. ${detail}`,
    );
  }
  await expect(page.getByRole('button', { name: /Calabresa/ })).toBeVisible({
    timeout: 10_000,
  });
}
