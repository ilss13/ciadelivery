import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const courierEmail = 'pizzariadoze-courier@example.com';

test('entra como entregador de demonstração e mostra a lista vazia', async ({
  page,
}) => {
  await openCourier(page);
  await page.getByLabel('Email').fill(courierEmail);
  await page.getByLabel('Senha').fill(demoPassword());
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page.getByText('Nenhuma entrega atribuída.')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole('heading', { name: 'Entregas' })).toBeVisible();
});

async function openCourier(page: Page): Promise<void> {
  const url = 'http://localhost:4203/login';
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Não foi possível abrir ${url}. Suba a API e o app courier antes do e2e: npm run start:api e npm run start:courier. ${detail}`,
    );
  }

  await expect(page.getByRole('heading', { name: 'Entregas' })).toBeVisible({
    timeout: 10_000,
  });
}

function demoPassword(): string {
  const fromEnv = process.env['DEMO_OWNER_PASSWORD']?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv;
  }

  const envFile = resolve(process.cwd(), '../../.env');
  let text = '';
  try {
    text = readFileSync(envFile, 'utf8');
  } catch {
    throw new Error(
      'Defina DEMO_OWNER_PASSWORD no ambiente ou no .env. A API precisa subir com SEED_DEMO=true para criar pizzariadoze-courier@example.com.',
    );
  }

  const value = readEnvValue(text, 'DEMO_OWNER_PASSWORD');
  if (value !== null && value.length > 0) {
    return value;
  }

  throw new Error(
    'DEMO_OWNER_PASSWORD está vazio. A API precisa subir com SEED_DEMO=true para criar o entregador de demonstração.',
  );
}

function readEnvValue(text: string, name: string): string | null {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }
    const normalized = trimmed.startsWith('export ')
      ? trimmed.slice('export '.length).trim()
      : trimmed;
    const separator = normalized.indexOf('=');
    if (separator <= 0 || normalized.slice(0, separator).trim() !== name) {
      continue;
    }
    let value = normalized.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return null;
}
