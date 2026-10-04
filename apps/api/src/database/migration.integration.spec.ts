import {
  loadAppConfig,
  loadEnvFile,
  createDataSource,
} from '@ciadelivery/shared';
import { MigrationInterface, QueryRunner } from 'typeorm';

class SchemaMigrationsProbe1740000000000 implements MigrationInterface {
  name = 'SchemaMigrationsProbe1740000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `schema_migrations_probe` (`id` int NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `schema_migrations_probe`');
  }
}

describe('migration pipeline', () => {
  const envSnapshot = { ...process.env };

  afterAll(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, envSnapshot);
  });

  it('applies a probe migration and reverts it', async () => {
    loadEnvFile();
    process.env['NODE_ENV'] = 'local';
    const dataSource = createDataSource(loadAppConfig(), {
      migrations: [SchemaMigrationsProbe1740000000000],
      migrationsTableName: 'schema_migrations_probe_history',
      migrationsTransactionMode: 'none',
    });

    await dataSource.initialize();
    try {
      await dataSource.query('DROP TABLE IF EXISTS `schema_migrations_probe`');
      await dataSource.query(
        'DROP TABLE IF EXISTS `schema_migrations_probe_history`',
      );
      await dataSource.runMigrations();
      const created = await dataSource.query(
        "SHOW TABLES LIKE 'schema_migrations_probe'",
      );
      expect(created).toHaveLength(1);

      await dataSource.undoLastMigration();
      const removed = await dataSource.query(
        "SHOW TABLES LIKE 'schema_migrations_probe'",
      );
      expect(removed).toHaveLength(0);
    } finally {
      await dataSource.query('DROP TABLE IF EXISTS `schema_migrations_probe`');
      await dataSource.query(
        'DROP TABLE IF EXISTS `schema_migrations_probe_history`',
      );
      await dataSource.destroy();
    }
  });
});
