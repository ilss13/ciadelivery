import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWhatsAppConversations1761300000000
  implements MigrationInterface
{
  name = 'CreateWhatsAppConversations1761300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`conversations\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`store_id\` char(36) NOT NULL,
        \`customer_id\` char(36) NULL,
        \`contact_phone\` varchar(32) NOT NULL,
        \`contact_name\` varchar(120) NULL,
        \`mode\` varchar(16) NOT NULL,
        \`linked_order_id\` char(36) NULL,
        \`last_message_at\` datetime(3) NOT NULL,
        \`created_at\` datetime(3) NOT NULL,
        \`updated_at\` datetime(3) NOT NULL,
        \`open_contact_phone\` varchar(32)
          GENERATED ALWAYS AS (
            CASE WHEN \`mode\` <> 'CLOSED' THEN \`contact_phone\` ELSE NULL END
          ) STORED,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_conversations_open_phone\` (\`tenant_id\`, \`open_contact_phone\`),
        KEY \`idx_conversations_store_recent\` (\`tenant_id\`, \`store_id\`, \`last_message_at\`),
        CONSTRAINT \`fk_conversations_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_conversations_store_id\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`),
        CONSTRAINT \`fk_conversations_customer_id\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_conversations_order_id\` FOREIGN KEY (\`linked_order_id\`) REFERENCES \`orders\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`chk_conversations_mode\` CHECK (\`mode\` IN ('BOT', 'HUMAN', 'PAUSED', 'CLOSED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      ALTER TABLE \`whatsapp_messages\`
        MODIFY \`template_key\` varchar(64) NULL,
        MODIFY \`event_id\` char(36) NULL,
        ADD COLUMN \`conversation_id\` char(36) NULL AFTER \`tenant_id\`,
        ADD COLUMN \`author\` varchar(16) NOT NULL DEFAULT 'SYSTEM' AFTER \`direction\`,
        ADD COLUMN \`external_id\` varchar(255) NULL AFTER \`event_id\`,
        ADD UNIQUE KEY \`uq_whatsapp_messages_external_id\` (\`external_id\`),
        ADD KEY \`idx_whatsapp_messages_conversation\` (\`conversation_id\`, \`created_at\`),
        ADD CONSTRAINT \`fk_whatsapp_messages_conversation_id\`
          FOREIGN KEY (\`conversation_id\`) REFERENCES \`conversations\` (\`id\`) ON DELETE SET NULL,
        ADD CONSTRAINT \`chk_whatsapp_messages_author\`
          CHECK (\`author\` IN ('CUSTOMER', 'USER', 'SYSTEM'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`whatsapp_messages\`
        DROP FOREIGN KEY \`fk_whatsapp_messages_conversation_id\`,
        DROP CHECK \`chk_whatsapp_messages_author\`,
        DROP INDEX \`uq_whatsapp_messages_external_id\`,
        DROP INDEX \`idx_whatsapp_messages_conversation\`,
        DROP COLUMN \`external_id\`,
        DROP COLUMN \`author\`,
        DROP COLUMN \`conversation_id\`
    `);
    await queryRunner.query(`
      DELETE FROM \`whatsapp_messages\`
       WHERE \`template_key\` IS NULL OR \`event_id\` IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE \`whatsapp_messages\`
        MODIFY \`template_key\` varchar(64) NOT NULL,
        MODIFY \`event_id\` char(36) NOT NULL
    `);
    await queryRunner.query('DROP TABLE `conversations`');
  }
}
