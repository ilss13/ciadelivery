#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${NODE_ENV:-local}" == "production" ]]; then
  echo "Erro: o smoke não deve ser executado contra production." >&2
  exit 1
fi

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}" \
PLATFORM_ADMIN_EMAIL="${PLATFORM_ADMIN_EMAIL:-platform-admin@ciadelivery.test}" \
PLATFORM_ADMIN_PASSWORD="${PLATFORM_ADMIN_PASSWORD:-PlatformAdmin1}" \
node <<'NODE'
const base = process.env.API_BASE_URL.replace(/\/$/, '');
const adminEmail = process.env.PLATFORM_ADMIN_EMAIL;
const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD;
const unique = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const slug = `smoke-${unique}`;
const ownerEmail = `${slug}@example.test`;
const ownerPassword = 'SmokeOwner123';

async function call(path, options = {}, expected = 200) {
  const response = await fetch(`${base}${path}`, options);
  const type = response.headers.get('content-type') ?? '';
  const body = type.includes('json')
    ? await response.json()
    : await response.text();
  const statuses = Array.isArray(expected) ? expected : [expected];
  if (!statuses.includes(response.status)) {
    throw new Error(
      `${options.method ?? 'GET'} ${path}: esperado ${statuses.join('/')} e recebido ${response.status}\n${JSON.stringify(body)}`,
    );
  }
  return body;
}

function json(method, body, token, extraHeaders = {}) {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

const address = {
  line: 'Rua das Flores',
  number: '100',
  district: 'Centro',
  city: 'Sao Paulo',
  state: 'SP',
  postalCode: '01000-000',
};

(async () => {
  const platformLogin = await call(
    '/api/v1/auth/login',
    json('POST', { email: adminEmail, password: adminPassword }),
  );
  const platformToken = platformLogin.accessToken;

  const tenant = await call(
    '/api/v1/platform/tenants',
    json(
      'POST',
      { name: `Smoke ${unique}`, slug, phone: '11999999999', address },
      platformToken,
    ),
    201,
  );
  await call(
    `/api/v1/platform/tenants/${tenant.id}/owner`,
    json(
      'POST',
      {
        name: 'Responsável Smoke',
        email: ownerEmail,
        password: ownerPassword,
      },
      platformToken,
    ),
    201,
  );
  const ownerLogin = await call(
    '/api/v1/auth/login',
    json('POST', { email: ownerEmail, password: ownerPassword }),
  );
  const ownerToken = ownerLogin.accessToken;

  await call(
    '/api/v1/admin/branding',
    json(
      'PUT',
      {
        displayName: `Smoke ${unique}`,
        logoUrl: null,
        faviconUrl: null,
        bannerUrl: null,
        primaryColor: '#112233',
        secondaryColor: '#FFFFFF',
        accentColor: '#CC5500',
        fontFamily: null,
        seoTitle: `Smoke ${unique}`,
        seoDescription: '',
        instagramUrl: null,
        facebookUrl: null,
        websiteUrl: null,
        contactEmail: null,
        whatsappPhone: null,
      },
      ownerToken,
    ),
  );
  await call(
    '/api/v1/admin/store',
    json(
      'PUT',
      {
        name: `Smoke ${unique}`,
        phone: '11999999999',
        address,
        minimumOrderCents: 0,
        isManuallyClosed: false,
      },
      ownerToken,
    ),
  );
  await call(
    '/api/v1/admin/store/hours',
    json(
      'PUT',
      {
        hours: Array.from({ length: 7 }, (_, weekday) => ({
          weekday,
          opensAt: '00:00:00',
          closesAt: '23:59:59',
          closed: false,
        })),
      },
      ownerToken,
    ),
  );
  await call(
    '/api/v1/admin/delivery/config',
    json(
      'PUT',
      {
        deliveryEnabled: true,
        pickupEnabled: true,
        maxRadiusKm: 8,
        feeMode: 'FLAT',
        flatFeeCents: 500,
        estimatedMinutes: 40,
      },
      ownerToken,
    ),
  );

  const template = await call('/api/v1/admin/catalog/import-template', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const form = new FormData();
  form.append('file', new Blob([template], { type: 'text/csv' }), 'modelo-cardapio.csv');
  await call(
    '/api/v1/admin/catalog/import',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
      body: form,
    },
  );
  await call(
    '/api/v1/admin/store/publish',
    json('POST', {}, ownerToken),
  );

  const tenantHeader = { 'X-Tenant-Host': `${slug}.localhost` };
  const products = await call('/api/v1/public/products', {
    headers: tenantHeader,
  });
  const product = products.data?.[0];
  if (!product) throw new Error('O catálogo público não retornou produto.');
  const optionIds = (product.optionGroups ?? []).flatMap((group) =>
    (group.options ?? []).slice(0, group.minSelect).map((option) => option.id),
  );
  const items = [
    {
      productId: product.id,
      quantity: 1,
      optionIds,
      notes: null,
    },
  ];

  const outside = await call(
    '/api/v1/public/orders/review',
    json(
      'POST',
      {
        fulfillment: 'DELIVERY',
        address: { ...address, postalCode: '99999-999' },
        paymentMethodCode: 'CASH',
        items,
      },
      undefined,
      tenantHeader,
    ),
    422,
  );
  if (outside.error?.code !== 'OUT_OF_AREA') {
    throw new Error(`Quote fora da área retornou ${outside.error?.code}.`);
  }

  const created = await call(
    '/api/v1/public/orders',
    json(
      'POST',
      {
        customer: { name: 'Cliente Smoke', phone: '11988887777' },
        fulfillment: 'PICKUP',
        address: null,
        paymentMethodCode: 'CASH',
        notes: 'SMOKE_BUSINESS_DAY',
        consents: {
          operational: true,
          marketing: false,
          policyVersion: 'smoke-v1',
        },
        items,
      },
      undefined,
      { ...tenantHeader, 'Idempotency-Key': `smoke-${unique}` },
    ),
    201,
  );

  for (const action of ['accept', 'start-preparation', 'ready', 'complete-pickup']) {
    await call(
      `/api/v1/admin/orders/${created.orderId}/${action}`,
      json('POST', {}, ownerToken),
    );
  }

  await call('/api/v1/admin/dashboard', {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const today = new Date().toISOString().slice(0, 10);
  await call(`/api/v1/admin/reports/overview?from=${today}&to=${today}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  const pilot = await call('/api/v1/platform/pilot-status', {
    headers: { Authorization: `Bearer ${platformToken}` },
  });
  const status = pilot.tenants?.find((item) => item.tenantId === tenant.id);
  if (!status?.published || status.storefrontOrdersLast7Days < 1) {
    throw new Error('A telemetria do piloto não refletiu o smoke.');
  }

  console.log(`Smoke concluído para o tenant técnico ${slug}.`);
})().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
NODE
