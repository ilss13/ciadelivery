import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTestOrderSource1761800000000 implements MigrationInterface {
  name = 'AddTestOrderSource1761800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`orders\`
        DROP CHECK \`chk_orders_source\`,
        ADD CONSTRAINT \`chk_orders_source\`
          CHECK (\`source\` IN ('STOREFRONT', 'WHATSAPP', 'TEST')),
        ADD KEY \`idx_orders_tenant_source_status_created\`
          (\`tenant_id\`, \`source\`, \`status\`, \`created_at\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DELETE FROM `orders` WHERE `source` = 'TEST'");
    await queryRunner.query(`
      ALTER TABLE \`orders\`
        DROP CHECK \`chk_orders_source\`,
        DROP INDEX \`idx_orders_tenant_source_status_created\`,
        ADD CONSTRAINT \`chk_orders_source\`
          CHECK (\`source\` IN ('STOREFRONT', 'WHATSAPP'))
    `);
  }
}
