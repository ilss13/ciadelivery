import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBrandingAndBusinessHours1760200000000
  implements MigrationInterface
{
  name = 'CreateBrandingAndBusinessHours1760200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`stores\`
      ADD COLUMN \`timezone\` varchar(64) NOT NULL DEFAULT 'America/Sao_Paulo' AFTER \`is_manually_closed\`
    `);
    await queryRunner.query(`
      CREATE TABLE \`branding_configs\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`store_id\` char(36) NOT NULL,
        \`display_name\` varchar(160) NOT NULL,
        \`logo_url\` varchar(500) NULL,
        \`favicon_url\` varchar(500) NULL,
        \`banner_url\` varchar(500) NULL,
        \`primary_color\` char(7) NOT NULL,
        \`secondary_color\` char(7) NOT NULL,
        \`accent_color\` char(7) NOT NULL,
        \`font_family\` varchar(80) NULL,
        \`seo_title\` varchar(180) NOT NULL,
        \`seo_description\` varchar(320) NOT NULL,
        \`instagram_url\` varchar(500) NULL,
        \`facebook_url\` varchar(500) NULL,
        \`website_url\` varchar(500) NULL,
        \`contact_email\` varchar(255) NULL,
        \`whatsapp_phone\` varchar(20) NULL,
        \`created_at\` datetime(3) NOT NULL,
        \`updated_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_branding_configs_tenant_store\` (\`tenant_id\`, \`store_id\`),
        UNIQUE KEY \`uq_branding_configs_store_id\` (\`store_id\`),
        CONSTRAINT \`fk_branding_configs_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_branding_configs_store_id\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`),
        CONSTRAINT \`chk_branding_primary_color\` CHECK (\`primary_color\` REGEXP '^#[0-9A-F]{6}$'),
        CONSTRAINT \`chk_branding_secondary_color\` CHECK (\`secondary_color\` REGEXP '^#[0-9A-F]{6}$'),
        CONSTRAINT \`chk_branding_accent_color\` CHECK (\`accent_color\` REGEXP '^#[0-9A-F]{6}$')
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`business_hours\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`store_id\` char(36) NOT NULL,
        \`weekday\` tinyint NOT NULL,
        \`opens_at\` time NOT NULL,
        \`closes_at\` time NOT NULL,
        \`closed\` tinyint NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_business_hours_store_weekday\` (\`store_id\`, \`weekday\`),
        KEY \`idx_business_hours_tenant_id\` (\`tenant_id\`),
        CONSTRAINT \`fk_business_hours_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_business_hours_store_id\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`),
        CONSTRAINT \`chk_business_hours_weekday\` CHECK (\`weekday\` BETWEEN 0 AND 6)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `business_hours`');
    await queryRunner.query('DROP TABLE IF EXISTS `branding_configs`');
    await queryRunner.query(
      'ALTER TABLE `stores` DROP COLUMN `timezone`',
    );
  }
}
