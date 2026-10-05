import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDeliveryConfig1760900000000 implements MigrationInterface {
  name = 'CreateDeliveryConfig1760900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`delivery_configs\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`store_id\` char(36) NOT NULL,
        \`delivery_enabled\` tinyint NOT NULL,
        \`pickup_enabled\` tinyint NOT NULL,
        \`max_radius_km\` decimal(6, 2) NOT NULL,
        \`fee_mode\` varchar(8) NOT NULL,
        \`flat_fee_cents\` int unsigned NOT NULL,
        \`estimated_minutes\` int unsigned NOT NULL,
        \`origin_latitude\` decimal(9, 6) NULL,
        \`origin_longitude\` decimal(9, 6) NULL,
        \`created_at\` datetime(3) NOT NULL,
        \`updated_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_delivery_configs_store_id\` (\`store_id\`),
        KEY \`idx_delivery_configs_tenant\` (\`tenant_id\`, \`store_id\`),
        CONSTRAINT \`fk_delivery_configs_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_delivery_configs_store_id\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`),
        CONSTRAINT \`chk_delivery_configs_delivery_enabled\` CHECK (\`delivery_enabled\` IN (0, 1)),
        CONSTRAINT \`chk_delivery_configs_pickup_enabled\` CHECK (\`pickup_enabled\` IN (0, 1)),
        CONSTRAINT \`chk_delivery_configs_radius\` CHECK (\`max_radius_km\` > 0),
        CONSTRAINT \`chk_delivery_configs_fee_mode\` CHECK (\`fee_mode\` IN ('FLAT', 'ZONE')),
        CONSTRAINT \`chk_delivery_configs_flat_fee\` CHECK (\`flat_fee_cents\` >= 0),
        CONSTRAINT \`chk_delivery_configs_minutes\` CHECK (\`estimated_minutes\` > 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      INSERT INTO \`delivery_configs\` (
        \`id\`, \`tenant_id\`, \`store_id\`, \`delivery_enabled\`, \`pickup_enabled\`,
        \`max_radius_km\`, \`fee_mode\`, \`flat_fee_cents\`, \`estimated_minutes\`,
        \`origin_latitude\`, \`origin_longitude\`, \`created_at\`, \`updated_at\`
      )
      SELECT
        UUID(), \`tenant_id\`, \`id\`, \`delivery_enabled\`, \`pickup_enabled\`,
        8.00, 'FLAT', \`delivery_flat_fee_cents\`, 40,
        \`latitude\`, \`longitude\`, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
      FROM \`stores\`
    `);
    await queryRunner.query(`
      CREATE TABLE \`delivery_zones\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`store_id\` char(36) NOT NULL,
        \`from_km\` decimal(6, 2) NOT NULL,
        \`to_km\` decimal(6, 2) NOT NULL,
        \`fee_cents\` int unsigned NOT NULL,
        \`sort_order\` int unsigned NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_delivery_zones_store\` (\`tenant_id\`, \`store_id\`, \`sort_order\`),
        CONSTRAINT \`fk_delivery_zones_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_delivery_zones_store_id\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`),
        CONSTRAINT \`chk_delivery_zones_range\` CHECK (\`from_km\` < \`to_km\`),
        CONSTRAINT \`chk_delivery_zones_fee\` CHECK (\`fee_cents\` >= 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      ALTER TABLE \`stores\`
        DROP CHECK \`chk_stores_delivery_enabled\`,
        DROP CHECK \`chk_stores_pickup_enabled\`,
        DROP COLUMN \`delivery_flat_fee_cents\`,
        DROP COLUMN \`delivery_enabled\`,
        DROP COLUMN \`pickup_enabled\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`stores\`
        ADD COLUMN \`pickup_enabled\` tinyint NOT NULL DEFAULT 1,
        ADD COLUMN \`delivery_enabled\` tinyint NOT NULL DEFAULT 1,
        ADD COLUMN \`delivery_flat_fee_cents\` int unsigned NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      UPDATE \`stores\` AS \`store\`
      INNER JOIN \`delivery_configs\` AS \`config\` ON \`config\`.\`store_id\` = \`store\`.\`id\`
      SET
        \`store\`.\`pickup_enabled\` = \`config\`.\`pickup_enabled\`,
        \`store\`.\`delivery_enabled\` = \`config\`.\`delivery_enabled\`,
        \`store\`.\`delivery_flat_fee_cents\` = \`config\`.\`flat_fee_cents\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`stores\`
        ADD CONSTRAINT \`chk_stores_pickup_enabled\` CHECK (\`pickup_enabled\` IN (0, 1)),
        ADD CONSTRAINT \`chk_stores_delivery_enabled\` CHECK (\`delivery_enabled\` IN (0, 1))
    `);
    await queryRunner.query('DROP TABLE IF EXISTS `delivery_zones`');
    await queryRunner.query('DROP TABLE IF EXISTS `delivery_configs`');
  }
}
