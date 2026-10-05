import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomers1760500000000 implements MigrationInterface {
  name = 'CreateCustomers1760500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`customers\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`store_id\` char(36) NOT NULL,
        \`name\` varchar(160) NOT NULL,
        \`phone\` varchar(16) NOT NULL,
        \`created_at\` datetime(3) NOT NULL,
        \`updated_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_customers_tenant_phone\` (\`tenant_id\`, \`phone\`),
        KEY \`idx_customers_tenant_store\` (\`tenant_id\`, \`store_id\`, \`created_at\`),
        CONSTRAINT \`fk_customers_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_customers_store_id\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`customer_addresses\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`customer_id\` char(36) NOT NULL,
        \`label\` varchar(40) NULL,
        \`address_line\` varchar(160) NOT NULL,
        \`address_number\` varchar(20) NOT NULL,
        \`complement\` varchar(80) NULL,
        \`district\` varchar(80) NOT NULL,
        \`city\` varchar(80) NOT NULL,
        \`state\` char(2) NOT NULL,
        \`postal_code\` varchar(16) NOT NULL,
        \`latitude\` decimal(9, 6) NULL,
        \`longitude\` decimal(9, 6) NULL,
        \`created_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_customer_addresses_customer\` (\`tenant_id\`, \`customer_id\`, \`created_at\`),
        CONSTRAINT \`fk_customer_addresses_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_customer_addresses_customer_id\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`customer_consents\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`customer_id\` char(36) NOT NULL,
        \`purpose\` varchar(16) NOT NULL,
        \`granted\` tinyint NOT NULL,
        \`policy_version\` varchar(32) NOT NULL,
        \`ip\` varchar(64) NOT NULL,
        \`user_agent\` varchar(512) NOT NULL,
        \`created_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_customer_consents_customer\` (\`tenant_id\`, \`customer_id\`, \`created_at\`),
        CONSTRAINT \`fk_customer_consents_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_customer_consents_customer_id\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`),
        CONSTRAINT \`chk_customer_consents_purpose\` CHECK (\`purpose\` IN ('OPERATIONAL', 'MARKETING')),
        CONSTRAINT \`chk_customer_consents_granted\` CHECK (\`granted\` IN (0, 1))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`payment_methods\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`store_id\` char(36) NOT NULL,
        \`code\` varchar(32) NOT NULL,
        \`label\` varchar(80) NOT NULL,
        \`instructions\` varchar(500) NULL,
        \`enabled\` tinyint NOT NULL,
        \`sort_order\` int NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_payment_methods_store_code\` (\`store_id\`, \`code\`),
        KEY \`idx_payment_methods_tenant_store\` (\`tenant_id\`, \`store_id\`, \`sort_order\`),
        CONSTRAINT \`fk_payment_methods_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_payment_methods_store_id\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`),
        CONSTRAINT \`chk_payment_methods_code\` CHECK (\`code\` IN ('CASH', 'CARD_ON_DELIVERY', 'PIX_MANUAL', 'PAY_ON_PICKUP', 'OTHER')),
        CONSTRAINT \`chk_payment_methods_enabled\` CHECK (\`enabled\` IN (0, 1)),
        CONSTRAINT \`chk_payment_methods_sort_order\` CHECK (\`sort_order\` >= 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      INSERT INTO \`payment_methods\` (
        \`id\`, \`tenant_id\`, \`store_id\`, \`code\`, \`label\`, \`instructions\`, \`enabled\`, \`sort_order\`
      )
      SELECT UUID(), \`tenant_id\`, \`id\`, 'CASH', 'Dinheiro', NULL, 1, 0 FROM \`stores\`
      UNION ALL
      SELECT UUID(), \`tenant_id\`, \`id\`, 'CARD_ON_DELIVERY', 'Cartão na entrega', NULL, 0, 1 FROM \`stores\`
      UNION ALL
      SELECT UUID(), \`tenant_id\`, \`id\`, 'PIX_MANUAL', 'PIX', NULL, 0, 2 FROM \`stores\`
      UNION ALL
      SELECT UUID(), \`tenant_id\`, \`id\`, 'PAY_ON_PICKUP', 'Pagar na retirada', NULL, 1, 3 FROM \`stores\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `payment_methods`');
    await queryRunner.query('DROP TABLE IF EXISTS `customer_consents`');
    await queryRunner.query('DROP TABLE IF EXISTS `customer_addresses`');
    await queryRunner.query('DROP TABLE IF EXISTS `customers`');
  }
}
