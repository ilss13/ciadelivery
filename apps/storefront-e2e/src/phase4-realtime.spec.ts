import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

const demoPassword = 'DemoOwner123';

test('pedido novo aparece no painel e o acompanhamento muda sem recarregar', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const api = await playwrightRequest.newContext({
    baseURL: 'http://localhost:3000',
  });
  const restore = await openDemoStore(api);
  const adminContext = await browser.newContext();
  const storeContext = await browser.newContext({
    viewport: { width: 360, height: 800 },
  });
  const admin = await adminContext.newPage();
  const store = await storeContext.newPage();
  try {
    await admin.goto('http://localhost:4202/login', { waitUntil: 'domcontentloaded' });
    await admin.getByLabel('Email').fill('pizzariadoze-owner@example.com');
    await admin.getByLabel('Senha').fill(demoPassword);
    await admin.getByRole('button', { name: 'Entrar' }).click();
    await admin.getByRole('link', { name: 'Pedidos' }).click();
    await expect(admin.getByRole('heading', { name: 'Novos' })).toBeVisible();

    await placeOrder(store);
    const heading = store.getByRole('heading', { level: 1 });
    await expect(heading).toHaveText(/Pedido \d+/);
    const orderNumber = ((await heading.textContent()) ?? '').replace('Pedido ', '').trim();
    const card = admin
      .locator('article.order-card')
      .filter({ has: admin.getByText(`Pedido ${orderNumber}`, { exact: true }) });
    await expect(card).toBeVisible({ timeout: 10_000 });

    await expect(store.getByRole('status')).toHaveText('Pedido realizado');
    await card.getByRole('button', { name: 'Aceitar' }).click();
    await expect(store.getByRole('status')).toHaveText('Aceito', { timeout: 10_000 });
    expect(store.url()).toContain('/pedido/');
  } finally {
    await storeContext.close();
    await adminContext.close();
    await restore();
    await api.dispose();
  }
});

async function placeOrder(page: Page): Promise<void> {
  await page.goto('http://pizzariadoze.localhost:4201/', {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.getByRole('button', { name: /Calabresa/ })).toBeVisible();
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
}

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
