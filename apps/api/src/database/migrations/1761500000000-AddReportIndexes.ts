import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReportIndexes1761500000000 implements MigrationInterface {
  name = 'AddReportIndexes1761500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`orders\`
        ADD COLUMN \`source\` varchar(16) NOT NULL DEFAULT 'STOREFRONT' AFTER \`fulfillment\`,
        ADD CONSTRAINT \`chk_orders_source\` CHECK (\`source\` IN ('STOREFRONT', 'WHATSAPP')),
        ADD KEY \`idx_orders_tenant_status_created\` (\`tenant_id\`, \`status\`, \`created_at\`),
        ADD KEY \`idx_orders_tenant_customer_created\` (\`tenant_id\`, \`customer_id\`, \`created_at\`)
    `);
    await queryRunner.query(`
      ALTER TABLE \`whatsapp_messages\`
        ADD KEY \`idx_whatsapp_messages_tenant_conversation\` (\`tenant_id\`, \`conversation_id\`, \`created_at\`)
    `);
    await queryRunner.query(`
      ALTER TABLE \`outbox_events\`
        ADD KEY \`idx_outbox_events_status_created\` (\`status\`, \`created_at\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `outbox_events` DROP INDEX `idx_outbox_events_status_created`',
    );
    await queryRunner.query(
      'ALTER TABLE `whatsapp_messages` DROP INDEX `idx_whatsapp_messages_tenant_conversation`',
    );
    await queryRunner.query(`
      ALTER TABLE \`orders\`
        DROP CHECK \`chk_orders_source\`,
        DROP INDEX \`idx_orders_tenant_status_created\`,
        DROP INDEX \`idx_orders_tenant_customer_created\`,
        DROP COLUMN \`source\`
    `);
  }
}
