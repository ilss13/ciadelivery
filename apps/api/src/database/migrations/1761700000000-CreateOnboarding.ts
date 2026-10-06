import { MigrationInterface, QueryRunner } from 'typeorm';

const CODES = [
  'create_tenant',
  'create_store',
  'configure_branding',
  'configure_domain',
  'configure_address',
  'configure_hours',
  'configure_delivery',
  'create_owner',
  'import_catalog',
  'connect_whatsapp',
  'create_couriers',
  'place_test_order',
  'validate_notifications',
  'train_team',
  'publish_store',
] as const;

export class CreateOnboarding1761700000000 implements MigrationInterface {
  name = 'CreateOnboarding1761700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `stores` ADD `published` tinyint NOT NULL DEFAULT 0',
    );
    await queryRunner.query('UPDATE `stores` SET `published` = 1');
    await queryRunner.query(`
      CREATE TABLE \`onboarding_steps\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`code\` varchar(40) NOT NULL,
        \`status\` varchar(16) NOT NULL,
        \`done_at\` datetime(3) NULL,
        \`done_by\` char(36) NULL,
        \`note\` varchar(500) NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_onboarding_steps_tenant_code\` (\`tenant_id\`, \`code\`),
        CONSTRAINT \`fk_onboarding_steps_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`chk_onboarding_steps_status\` CHECK (\`status\` IN ('PENDING', 'DONE', 'SKIPPED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    for (const code of CODES) {
      const done =
        code === 'create_tenant' ||
        code === 'create_store' ||
        code === 'publish_store';
      await queryRunner.query(
        `INSERT INTO \`onboarding_steps\` (
          \`id\`, \`tenant_id\`, \`code\`, \`status\`, \`done_at\`, \`done_by\`, \`note\`
        )
        SELECT UUID(), \`tenant_id\`, ?, ?, CASE WHEN ? = 'DONE' THEN \`created_at\` ELSE NULL END, NULL, NULL
        FROM \`stores\``,
        [code, done ? 'DONE' : 'PENDING', done ? 'DONE' : 'PENDING'],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `onboarding_steps`');
    await queryRunner.query('ALTER TABLE `stores` DROP COLUMN `published`');
  }
}
