import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantsAndStores1760000000000 implements MigrationInterface {
  name = 'CreateTenantsAndStores1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`tenants\` (
        \`id\` char(36) NOT NULL,
        \`name\` varchar(160) NOT NULL,
        \`slug\` varchar(63) NOT NULL,
        \`status\` varchar(20) NOT NULL,
        \`plan_code\` varchar(40) NOT NULL DEFAULT 'STANDARD',
        \`custom_domain\` varchar(255) NULL,
        \`created_at\` datetime(3) NOT NULL,
        \`updated_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_tenants_slug\` (\`slug\`),
        UNIQUE KEY \`uq_tenants_custom_domain\` (\`custom_domain\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`stores\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`name\` varchar(160) NOT NULL,
        \`phone\` varchar(20) NOT NULL,
        \`address_line\` varchar(160) NOT NULL,
        \`address_number\` varchar(20) NOT NULL,
        \`district\` varchar(80) NOT NULL,
        \`city\` varchar(80) NOT NULL,
        \`state\` varchar(40) NOT NULL,
        \`postal_code\` varchar(20) NOT NULL,
        \`latitude\` decimal(9,6) NULL,
        \`longitude\` decimal(9,6) NULL,
        \`minimum_order_cents\` int unsigned NOT NULL DEFAULT 0,
        \`is_manually_closed\` tinyint NOT NULL DEFAULT 0,
        \`created_at\` datetime(3) NOT NULL,
        \`updated_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_stores_tenant_id\` (\`tenant_id\`),
        CONSTRAINT \`fk_stores_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `stores`');
    await queryRunner.query('DROP TABLE IF EXISTS `tenants`');
  }
}
