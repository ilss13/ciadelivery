import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCatalog1760400000000 implements MigrationInterface {
  name = 'CreateCatalog1760400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`categories\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`store_id\` char(36) NOT NULL,
        \`name\` varchar(160) NOT NULL,
        \`description\` varchar(2000) NULL,
        \`sort_order\` int NOT NULL,
        \`active\` tinyint NOT NULL,
        \`created_at\` datetime(3) NOT NULL,
        \`updated_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_categories_tenant_store_active_sort\` (\`tenant_id\`, \`store_id\`, \`active\`, \`sort_order\`),
        CONSTRAINT \`fk_categories_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_categories_store_id\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`),
        CONSTRAINT \`chk_categories_sort_order\` CHECK (\`sort_order\` >= 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`products\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`store_id\` char(36) NOT NULL,
        \`category_id\` char(36) NOT NULL,
        \`name\` varchar(160) NOT NULL,
        \`description\` varchar(2000) NULL,
        \`price_cents\` int NOT NULL,
        \`sku\` varchar(64) NULL,
        \`image_key\` varchar(500) NULL,
        \`active\` tinyint NOT NULL,
        \`available\` tinyint NOT NULL,
        \`sort_order\` int NOT NULL,
        \`created_at\` datetime(3) NOT NULL,
        \`updated_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_products_tenant_category_active\` (\`tenant_id\`, \`category_id\`, \`active\`),
        CONSTRAINT \`fk_products_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_products_store_id\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`),
        CONSTRAINT \`fk_products_category_id\` FOREIGN KEY (\`category_id\`) REFERENCES \`categories\` (\`id\`),
        CONSTRAINT \`chk_products_price_cents\` CHECK (\`price_cents\` >= 0),
        CONSTRAINT \`chk_products_sort_order\` CHECK (\`sort_order\` >= 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`product_option_groups\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`store_id\` char(36) NOT NULL,
        \`product_id\` char(36) NOT NULL,
        \`name\` varchar(160) NOT NULL,
        \`min_select\` int NOT NULL,
        \`max_select\` int NOT NULL,
        \`sort_order\` int NOT NULL,
        \`created_at\` datetime(3) NOT NULL,
        \`updated_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_option_groups_tenant_product\` (\`tenant_id\`, \`store_id\`, \`product_id\`),
        CONSTRAINT \`fk_option_groups_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_option_groups_store_id\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`),
        CONSTRAINT \`fk_option_groups_product_id\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`),
        CONSTRAINT \`chk_option_groups_selection\` CHECK (\`min_select\` >= 0 AND \`max_select\` >= 1 AND \`min_select\` <= \`max_select\`),
        CONSTRAINT \`chk_option_groups_sort_order\` CHECK (\`sort_order\` >= 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`product_options\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`store_id\` char(36) NOT NULL,
        \`group_id\` char(36) NOT NULL,
        \`name\` varchar(160) NOT NULL,
        \`price_cents\` int NOT NULL,
        \`available\` tinyint NOT NULL,
        \`sort_order\` int NOT NULL,
        \`created_at\` datetime(3) NOT NULL,
        \`updated_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_options_tenant_group\` (\`tenant_id\`, \`store_id\`, \`group_id\`),
        CONSTRAINT \`fk_options_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_options_store_id\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`),
        CONSTRAINT \`fk_options_group_id\` FOREIGN KEY (\`group_id\`) REFERENCES \`product_option_groups\` (\`id\`),
        CONSTRAINT \`chk_options_price_cents\` CHECK (\`price_cents\` >= 0),
        CONSTRAINT \`chk_options_sort_order\` CHECK (\`sort_order\` >= 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `product_options`');
    await queryRunner.query('DROP TABLE IF EXISTS `product_option_groups`');
    await queryRunner.query('DROP TABLE IF EXISTS `products`');
    await queryRunner.query('DROP TABLE IF EXISTS `categories`');
  }
}
