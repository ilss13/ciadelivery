import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiConversationGuardrails1761900000000
  implements MigrationInterface
{
  name = 'CreateAiConversationGuardrails1761900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`stores\`
        ADD COLUMN \`ai_enabled\` tinyint NOT NULL DEFAULT 0 AFTER \`published\`,
        ADD COLUMN \`ai_auto_reply\` tinyint NOT NULL DEFAULT 0 AFTER \`ai_enabled\`
    `);
    await queryRunner.query(`
      CREATE TABLE \`ai_turns\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`conversation_id\` char(36) NOT NULL,
        \`confidence\` decimal(5,4) NOT NULL,
        \`outcome\` varchar(16) NOT NULL,
        \`prompt_hash\` char(64) NOT NULL,
        \`created_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_ai_turns_daily\` (\`tenant_id\`, \`conversation_id\`, \`created_at\`),
        CONSTRAINT \`fk_ai_turns_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_ai_turns_conversation_id\` FOREIGN KEY (\`conversation_id\`) REFERENCES \`conversations\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`chk_ai_turns_confidence\` CHECK (\`confidence\` >= 0 AND \`confidence\` <= 1),
        CONSTRAINT \`chk_ai_turns_outcome\` CHECK (\`outcome\` IN ('REPLIED', 'HANDOFF', 'BLOCKED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      ALTER TABLE \`whatsapp_messages\`
        DROP CHECK \`chk_whatsapp_messages_author\`,
        ADD CONSTRAINT \`chk_whatsapp_messages_author\`
          CHECK (\`author\` IN ('CUSTOMER', 'USER', 'BOT', 'SYSTEM'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`whatsapp_messages\` SET \`author\` = 'SYSTEM' WHERE \`author\` = 'BOT'
    `);
    await queryRunner.query(`
      ALTER TABLE \`whatsapp_messages\`
        DROP CHECK \`chk_whatsapp_messages_author\`,
        ADD CONSTRAINT \`chk_whatsapp_messages_author\`
          CHECK (\`author\` IN ('CUSTOMER', 'USER', 'SYSTEM'))
    `);
    await queryRunner.query('DROP TABLE `ai_turns`');
    await queryRunner.query(`
      ALTER TABLE \`stores\`
        DROP COLUMN \`ai_auto_reply\`,
        DROP COLUMN \`ai_enabled\`
    `);
  }
}
