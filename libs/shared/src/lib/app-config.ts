import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const NODE_ENVS = [
  'local',
  'development',
  'staging',
  'production',
] as const;

export type NodeEnv = (typeof NODE_ENVS)[number];

export interface AppConfig {
  nodeEnv: NodeEnv;
  apiPort: number;
  workerPort: number;
  databaseHost: string;
  databasePort: number;
  databaseUser: string;
  databasePassword: string;
  databaseName: string;
  databasePoolSize: number;
  redisHost: string;
  redisPort: number;
  platformDomain: string;
  jwtAccessSecret: string;
  seedPlatformAdmin: boolean;
  platformAdminEmail: string;
  platformAdminPassword: string;
  logPasswordReset: boolean;
  corsOrigins: string[];
  storeTimezone: string;
  seedDemo: boolean;
  demoOwnerPassword: string;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

const REQUIRED_ENV_KEYS = [
  'NODE_ENV',
  'API_PORT',
  'WORKER_PORT',
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
  'REDIS_HOST',
  'REDIS_PORT',
  'PLATFORM_DOMAIN',
  'JWT_ACCESS_SECRET',
  'CORS_ORIGINS',
] as const;

const DEFAULT_DATABASE_POOL_SIZE = 10;

type Env = Record<string, string | undefined>;

function isNodeEnv(value: string): value is NodeEnv {
  return (NODE_ENVS as readonly string[]).includes(value);
}

function parsePort(key: string, value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid ${key}: expected an integer port`);
  }

  const port = Number(value);
  if (port < 1 || port > 65535) {
    throw new Error(`Invalid ${key}: expected a port between 1 and 65535`);
  }

  return port;
}

function parsePoolSize(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_DATABASE_POOL_SIZE;
  }

  if (!/^\d+$/.test(value.trim())) {
    throw new Error('Invalid DATABASE_POOL_SIZE: expected a positive integer');
  }

  const poolSize = Number(value.trim());
  if (poolSize < 1) {
    throw new Error('Invalid DATABASE_POOL_SIZE: expected a positive integer');
  }

  return poolSize;
}

function parseCorsOrigins(value: string): string[] {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    throw new Error(
      'Invalid CORS_ORIGINS: expected a comma-separated list of origins',
    );
  }

  return origins;
}

export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  if (origin === undefined || origin.length === 0) {
    return true;
  }

  return allowedOrigins.includes(origin);
}

export function loadEnvFile(filePath = resolve(process.cwd(), '.env')): void {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadAppConfig(env: Env = process.env): AppConfig {
  const missing = REQUIRED_ENV_KEYS.filter((key) => {
    const value = env[key];
    return value === undefined || value.trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  const nodeEnv = env['NODE_ENV']?.trim() ?? '';
  if (!isNodeEnv(nodeEnv)) {
    throw new Error(
      `Invalid NODE_ENV "${nodeEnv}". Expected local, development, staging or production`,
    );
  }

  const apiPort = parsePort('API_PORT', env['API_PORT']?.trim() ?? '');
  const workerPort = parsePort('WORKER_PORT', env['WORKER_PORT']?.trim() ?? '');
  const databasePort = parsePort(
    'DATABASE_PORT',
    env['DATABASE_PORT']?.trim() ?? '',
  );
  const redisPort = parsePort('REDIS_PORT', env['REDIS_PORT']?.trim() ?? '');
  const jwtAccessSecret = env['JWT_ACCESS_SECRET']?.trim() ?? '';
  if (jwtAccessSecret.length < 32) {
    throw new Error(
      'Invalid JWT_ACCESS_SECRET: expected at least 32 characters',
    );
  }

  const seedPlatformAdmin = parseFlag(env['SEED_PLATFORM_ADMIN']);
  if (seedPlatformAdmin && nodeEnv === 'production') {
    throw new Error('SEED_PLATFORM_ADMIN must not be enabled in production');
  }

  const platformAdminEmail = env['PLATFORM_ADMIN_EMAIL']?.trim().toLowerCase() ?? '';
  const platformAdminPassword = env['PLATFORM_ADMIN_PASSWORD'] ?? '';
  if (seedPlatformAdmin && platformAdminEmail.length === 0) {
    throw new Error(
      'Missing required environment variables: PLATFORM_ADMIN_EMAIL',
    );
  }
  if (seedPlatformAdmin && platformAdminPassword.trim().length === 0) {
    throw new Error(
      'Missing required environment variables: PLATFORM_ADMIN_PASSWORD',
    );
  }

  const seedDemo = parseFlag(env['SEED_DEMO']);
  if (seedDemo && nodeEnv === 'production') {
    throw new Error('SEED_DEMO must not be enabled in production');
  }

  const demoOwnerPassword = env['DEMO_OWNER_PASSWORD'] ?? '';
  if (seedDemo && demoOwnerPassword.trim().length === 0) {
    throw new Error(
      'Missing required environment variables: DEMO_OWNER_PASSWORD',
    );
  }

  return {
    nodeEnv,
    apiPort,
    workerPort,
    databaseHost: env['DATABASE_HOST']?.trim() ?? '',
    databasePort,
    databaseUser: env['DATABASE_USER']?.trim() ?? '',
    databasePassword: env['DATABASE_PASSWORD']?.trim() ?? '',
    databaseName: env['DATABASE_NAME']?.trim() ?? '',
    databasePoolSize: parsePoolSize(env['DATABASE_POOL_SIZE']),
    redisHost: env['REDIS_HOST']?.trim() ?? '',
    redisPort,
    platformDomain: env['PLATFORM_DOMAIN']?.trim() ?? '',
    jwtAccessSecret,
    seedPlatformAdmin,
    platformAdminEmail,
    platformAdminPassword,
    logPasswordReset: parseFlag(env['LOG_PASSWORD_RESET']),
    corsOrigins: parseCorsOrigins(env['CORS_ORIGINS']?.trim() ?? ''),
    storeTimezone: parseStoreTimezone(env['STORE_TIMEZONE']),
    seedDemo,
    demoOwnerPassword,
  };
}

function parseStoreTimezone(value: string | undefined): string {
  const timeZone =
    value === undefined || value.trim() === ''
      ? 'America/Sao_Paulo'
      : value.trim();

  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format(0);
  } catch {
    throw new Error(`Invalid STORE_TIMEZONE: ${timeZone}`);
  }

  return timeZone;
}

function parseFlag(value: string | undefined): boolean {
  return value?.trim() === 'true';
}
