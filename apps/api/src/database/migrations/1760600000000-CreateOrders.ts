import { MigrationInterface, QueryRunner } from 'typeorm';

const ORDER_STATUSES =
  "'NEW', 'ACCEPTED', 'IN_PREPARATION', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'REJECTED', 'CANCELLED'";

export class CreateOrders1760600000000 implements MigrationInterface {
  name = 'CreateOrders1760600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`stores\`
        ADD COLUMN \`pickup_enabled\` tinyint NOT NULL DEFAULT 1,
        ADD COLUMN \`delivery_enabled\` tinyint NOT NULL DEFAULT 1,
        ADD COLUMN \`delivery_flat_fee_cents\` int unsigned NOT NULL DEFAULT 0,
        ADD COLUMN \`estimated_prep_minutes\` int unsigned NOT NULL DEFAULT 40,
        ADD CONSTRAINT \`chk_stores_pickup_enabled\` CHECK (\`pickup_enabled\` IN (0, 1)),
        ADD CONSTRAINT \`chk_stores_delivery_enabled\` CHECK (\`delivery_enabled\` IN (0, 1))
    `);
    await queryRunner.query(`
      CREATE TABLE \`tenant_order_counters\` (
        \`tenant_id\` char(36) NOT NULL,
        \`last_number\` int unsigned NOT NULL,
        PRIMARY KEY (\`tenant_id\`),
        CONSTRAINT \`fk_tenant_order_counters_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`orders\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`store_id\` char(36) NOT NULL,
        \`customer_id\` char(36) NOT NULL,
        \`order_number\` int unsigned NOT NULL,
        \`status\` varchar(32) NOT NULL,
        \`fulfillment\` varchar(16) NOT NULL,
        \`payment_method_code\` varchar(32) NOT NULL,
        \`payment_label\` varchar(80) NOT NULL,
        \`payment_instructions\` varchar(500) NULL,
        \`customer_name\` varchar(160) NOT NULL,
        \`customer_phone\` varchar(16) NOT NULL,
        \`address_snapshot\` json NULL,
        \`subtotal_cents\` int unsigned NOT NULL,
        \`delivery_fee_cents\` int unsigned NOT NULL,
        \`total_cents\` int unsigned NOT NULL,
        \`notes\` varchar(280) NULL,
        \`tracking_token_hash\` char(64) NOT NULL,
        \`idempotency_key\` varchar(128) NOT NULL,
        \`created_at\` datetime(3) NOT NULL,
        \`updated_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_orders_tenant_number\` (\`tenant_id\`, \`order_number\`),
        UNIQUE KEY \`uq_orders_tracking_token_hash\` (\`tracking_token_hash\`),
        UNIQUE KEY \`uq_orders_tenant_idempotency\` (\`tenant_id\`, \`idempotency_key\`),
        KEY \`idx_orders_tenant_created\` (\`tenant_id\`, \`created_at\`),
        CONSTRAINT \`fk_orders_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_orders_store_id\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`),
        CONSTRAINT \`fk_orders_customer_id\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`),
        CONSTRAINT \`chk_orders_status\` CHECK (\`status\` IN (${ORDER_STATUSES})),
        CONSTRAINT \`chk_orders_fulfillment\` CHECK (\`fulfillment\` IN ('DELIVERY', 'PICKUP'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`order_items\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`order_id\` char(36) NOT NULL,
        \`position\` int unsigned NOT NULL,
        \`product_id\` char(36) NULL,
        \`product_name\` varchar(160) NOT NULL,
        \`sku\` varchar(64) NULL,
        \`unit_price_cents\` int unsigned NOT NULL,
        \`quantity\` int unsigned NOT NULL,
        \`notes\` varchar(280) NULL,
        \`options_snapshot\` json NOT NULL,
        \`subtotal_cents\` int unsigned NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_order_items_order\` (\`tenant_id\`, \`order_id\`, \`position\`),
        CONSTRAINT \`fk_order_items_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_order_items_order_id\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`),
        CONSTRAINT \`chk_order_items_quantity\` CHECK (\`quantity\` BETWEEN 1 AND 99)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`order_status_history\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`order_id\` char(36) NOT NULL,
        \`from_status\` varchar(32) NULL,
        \`to_status\` varchar(32) NOT NULL,
        \`actor_type\` varchar(16) NOT NULL,
        \`actor_id\` char(36) NULL,
        \`note\` varchar(280) NULL,
        \`created_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_order_status_history_order\` (\`tenant_id\`, \`order_id\`, \`created_at\`),
        CONSTRAINT \`fk_order_status_history_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_order_status_history_order_id\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`),
        CONSTRAINT \`chk_order_history_from_status\` CHECK (\`from_status\` IS NULL OR \`from_status\` IN (${ORDER_STATUSES})),
        CONSTRAINT \`chk_order_history_to_status\` CHECK (\`to_status\` IN (${ORDER_STATUSES})),
        CONSTRAINT \`chk_order_history_actor_type\` CHECK (\`actor_type\` IN ('CUSTOMER', 'USER', 'SYSTEM'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`idempotency_records\` (
        \`tenant_id\` char(36) NOT NULL,
        \`key\` varchar(128) NOT NULL,
        \`request_hash\` char(64) NOT NULL,
        \`status_code\` smallint NOT NULL,
        \`response_body\` json NULL,
        \`created_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`tenant_id\`, \`key\`),
        CONSTRAINT \`fk_idempotency_records_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `idempotency_records`');
    await queryRunner.query('DROP TABLE IF EXISTS `order_status_history`');
    await queryRunner.query('DROP TABLE IF EXISTS `order_items`');
    await queryRunner.query('DROP TABLE IF EXISTS `orders`');
    await queryRunner.query('DROP TABLE IF EXISTS `tenant_order_counters`');
    await queryRunner.query(`
      ALTER TABLE \`stores\`
        DROP CHECK \`chk_stores_delivery_enabled\`,
        DROP CHECK \`chk_stores_pickup_enabled\`,
        DROP COLUMN \`estimated_prep_minutes\`,
        DROP COLUMN \`delivery_flat_fee_cents\`,
        DROP COLUMN \`delivery_enabled\`,
        DROP COLUMN \`pickup_enabled\`
    `);
  }
}
