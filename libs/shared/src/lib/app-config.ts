import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

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
  storageDriver: 'local' | 's3';
  storageLocalDir: string;
  storagePublicBaseUrl: string;
  s3Endpoint: string;
  s3Bucket: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3Region: string;
  geocodingDriver: 'stub' | 'http';
  geocodingUrl: string;
  credentialsEncryptionKey: string;
  whatsappDriver: 'log' | 'meta';
  metaGraphVersion: string;
  metaAppSecret: string;
  metaWebhookVerifyToken: string;
  whatsappAllowSessionMessages: boolean;
  llmDriver: 'none' | 'http';
  llmApiUrl: string;
  aiConfidenceMin: number;
  metricsToken: string | null;
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

function parseCorsOrigins(value: string, nodeEnv: NodeEnv): string[] {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    throw new Error(
      'Invalid CORS_ORIGINS: expected a comma-separated list of origins',
    );
  }
  if (
    (nodeEnv === 'staging' || nodeEnv === 'production') &&
    origins.includes('*')
  ) {
    throw new Error(
      'Invalid CORS_ORIGINS: wildcard is not allowed in staging or production',
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

  const platformAdminEmail =
    env['PLATFORM_ADMIN_EMAIL']?.trim().toLowerCase() ?? '';
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
    corsOrigins: parseCorsOrigins(env['CORS_ORIGINS']?.trim() ?? '', nodeEnv),
    storeTimezone: parseStoreTimezone(env['STORE_TIMEZONE']),
    seedDemo,
    demoOwnerPassword,
    ...storageConfig(env, apiPort),
    ...geocodingConfig(env),
    ...whatsappConfig(env, nodeEnv),
    ...llmConfig(env),
    metricsToken: metricsToken(env),
  };
}

function llmConfig(
  env: Env,
): Pick<AppConfig, 'llmDriver' | 'llmApiUrl' | 'aiConfidenceMin'> {
  const rawDriver = env['LLM_DRIVER']?.trim() ?? '';
  const llmDriver = rawDriver.length === 0 ? 'none' : rawDriver;
  if (llmDriver !== 'none' && llmDriver !== 'http') {
    throw new Error('Invalid LLM_DRIVER: expected none or http');
  }
  const llmApiUrl = env['LLM_API_URL']?.trim() ?? '';
  if (llmDriver === 'http' && llmApiUrl.length === 0) {
    throw new Error('Missing required environment variables: LLM_API_URL');
  }
  if (llmApiUrl.length > 0) {
    try {
      new URL(llmApiUrl);
    } catch {
      throw new Error('Invalid LLM_API_URL: expected an absolute URL');
    }
  }
  const rawConfidence = env['AI_CONFIDENCE_MIN']?.trim() ?? '';
  const aiConfidenceMin =
    rawConfidence.length === 0 ? 0.6 : Number(rawConfidence);
  if (
    !Number.isFinite(aiConfidenceMin) ||
    aiConfidenceMin < 0 ||
    aiConfidenceMin > 1
  ) {
    throw new Error('Invalid AI_CONFIDENCE_MIN: expected a number from 0 to 1');
  }
  return { llmDriver, llmApiUrl, aiConfidenceMin };
}

function metricsToken(env: Env): string | null {
  const token = env['METRICS_TOKEN']?.trim() ?? '';
  return token.length === 0 ? null : token;
}

function storageConfig(
  env: Env,
  apiPort: number,
): Pick<
  AppConfig,
  | 'storageDriver'
  | 'storageLocalDir'
  | 'storagePublicBaseUrl'
  | 's3Endpoint'
  | 's3Bucket'
  | 's3AccessKey'
  | 's3SecretKey'
  | 's3Region'
> {
  const driverValue = env['STORAGE_DRIVER']?.trim() ?? '';
  const storageDriver = driverValue.length === 0 ? 'local' : driverValue;
  if (storageDriver !== 'local' && storageDriver !== 's3') {
    throw new Error('Invalid STORAGE_DRIVER: expected local or s3');
  }

  const localDirValue = env['STORAGE_LOCAL_DIR']?.trim() ?? '';
  const storageLocalDir =
    localDirValue.length === 0
      ? resolve('storage')
      : isAbsolute(localDirValue)
        ? localDirValue
        : resolve(localDirValue);

  const publicBase = env['STORAGE_PUBLIC_BASE_URL']?.trim() ?? '';
  const storagePublicBaseUrl =
    publicBase.length === 0
      ? `http://localhost:${apiPort}`
      : publicBase.replace(/\/$/, '');

  const s3Endpoint = env['S3_ENDPOINT']?.trim() ?? '';
  const s3Bucket = env['S3_BUCKET']?.trim() ?? '';
  const s3AccessKey = env['S3_ACCESS_KEY']?.trim() ?? '';
  const s3SecretKey = env['S3_SECRET_KEY'] ?? '';
  const s3Region = env['S3_REGION']?.trim() ?? '';
  if (storageDriver === 's3') {
    const missing = [
      ['S3_ENDPOINT', s3Endpoint],
      ['S3_BUCKET', s3Bucket],
      ['S3_ACCESS_KEY', s3AccessKey],
      ['S3_SECRET_KEY', s3SecretKey.trim()],
      ['S3_REGION', s3Region],
    ]
      .filter(([, value]) => value.length === 0)
      .map(([key]) => key);
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`,
      );
    }
  }

  return {
    storageDriver,
    storageLocalDir,
    storagePublicBaseUrl,
    s3Endpoint,
    s3Bucket,
    s3AccessKey,
    s3SecretKey,
    s3Region,
  };
}

function geocodingConfig(
  env: Env,
): Pick<AppConfig, 'geocodingDriver' | 'geocodingUrl'> {
  const driverValue = env['GEOCODING_DRIVER']?.trim() ?? '';
  const geocodingDriver = driverValue.length === 0 ? 'stub' : driverValue;
  if (geocodingDriver !== 'stub' && geocodingDriver !== 'http') {
    throw new Error('Invalid GEOCODING_DRIVER: expected stub or http');
  }

  const geocodingUrl = env['GEOCODING_URL']?.trim() ?? '';
  if (geocodingDriver === 'http' && geocodingUrl.length === 0) {
    throw new Error('Missing required environment variables: GEOCODING_URL');
  }

  return { geocodingDriver, geocodingUrl };
}

function whatsappConfig(
  env: Env,
  nodeEnv: NodeEnv,
): Pick<
  AppConfig,
  | 'credentialsEncryptionKey'
  | 'whatsappDriver'
  | 'metaGraphVersion'
  | 'metaAppSecret'
  | 'metaWebhookVerifyToken'
  | 'whatsappAllowSessionMessages'
> {
  const rawKey = env['CREDENTIALS_ENCRYPTION_KEY']?.trim() ?? '';
  if (rawKey.length === 0 && nodeEnv === 'local') {
    throw new Error(
      'Missing required environment variables: CREDENTIALS_ENCRYPTION_KEY',
    );
  }
  if (rawKey.length > 0) {
    const key = Buffer.from(rawKey, 'base64');
    if (key.length !== 32) {
      throw new Error(
        'Invalid CREDENTIALS_ENCRYPTION_KEY: expected 32 bytes in base64',
      );
    }
  }

  const driverValue = env['WHATSAPP_DRIVER']?.trim() ?? '';
  const whatsappDriver = driverValue.length === 0 ? 'log' : driverValue;
  if (whatsappDriver !== 'log' && whatsappDriver !== 'meta') {
    throw new Error('Invalid WHATSAPP_DRIVER: expected log or meta');
  }

  const versionValue = env['META_GRAPH_VERSION']?.trim() ?? '';
  const metaGraphVersion = versionValue.length === 0 ? 'v21.0' : versionValue;
  if (!/^v\d+\.\d+$/.test(metaGraphVersion)) {
    throw new Error(
      'Invalid META_GRAPH_VERSION: expected a version like v21.0',
    );
  }
  const metaAppSecret = env['META_APP_SECRET']?.trim() ?? '';
  const metaWebhookVerifyToken =
    env['META_WEBHOOK_VERIFY_TOKEN']?.trim() ?? '';
  if (
    whatsappDriver === 'meta' &&
    (metaAppSecret.length === 0 || metaWebhookVerifyToken.length === 0)
  ) {
    throw new Error(
      'Missing required environment variables: META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN',
    );
  }

  return {
    credentialsEncryptionKey: rawKey,
    whatsappDriver,
    metaGraphVersion,
    metaAppSecret,
    metaWebhookVerifyToken,
    whatsappAllowSessionMessages:
      nodeEnv === 'production'
        ? false
        : parseFlag(env['WHATSAPP_ALLOW_SESSION_MESSAGES']),
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
