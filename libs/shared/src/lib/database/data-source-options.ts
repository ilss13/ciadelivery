import { DataSource, DataSourceOptions } from 'typeorm';
import { AppConfig } from '../app-config';

export interface DataSourceOverrides {
  migrations?: NonNullable<DataSourceOptions['migrations']>;
  migrationsTableName?: string;
  migrationsTransactionMode?: 'all' | 'none' | 'each';
}

export function createDataSourceOptions(config: AppConfig): DataSourceOptions {
  return createMysqlOptions(config, {});
}

export function createDataSource(
  config: AppConfig,
  overrides: DataSourceOverrides = {},
): DataSource {
  return new DataSource(createMysqlOptions(config, overrides));
}

function createMysqlOptions(
  config: AppConfig,
  overrides: DataSourceOverrides,
): DataSourceOptions {
  return {
    type: 'mysql',
    host: config.databaseHost,
    port: config.databasePort,
    username: config.databaseUser,
    password: config.databasePassword,
    database: config.databaseName,
    synchronize: false,
    logging: false,
    timezone: 'Z',
    charset: 'utf8mb4',
    extra: {
      connectionLimit: config.databasePoolSize,
    },
    entities: [],
    migrations: overrides.migrations ?? [],
    ...(overrides.migrationsTableName === undefined
      ? {}
      : { migrationsTableName: overrides.migrationsTableName }),
    ...(overrides.migrationsTransactionMode === undefined
      ? {}
      : { migrationsTransactionMode: overrides.migrationsTransactionMode }),
  };
}
