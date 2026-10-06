import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderPreviews1762000000000 implements MigrationInterface {
  name = 'CreateOrderPreviews1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`order_previews\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`store_id\` char(36) NOT NULL,
        \`conversation_id\` char(36) NOT NULL,
        \`token_hash\` char(64) NOT NULL,
        \`payload\` json NOT NULL,
        \`expires_at\` datetime(3) NOT NULL,
        \`invalidated_at\` datetime(3) NULL,
        \`created_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_order_previews_token_hash\` (\`token_hash\`),
        KEY \`idx_order_previews_conversation\`
          (\`tenant_id\`, \`conversation_id\`, \`invalidated_at\`, \`expires_at\`),
        CONSTRAINT \`fk_order_previews_tenant_id\`
          FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_order_previews_store_id\`
          FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`),
        CONSTRAINT \`fk_order_previews_conversation_id\`
          FOREIGN KEY (\`conversation_id\`) REFERENCES \`conversations\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `order_previews`');
  }
}
