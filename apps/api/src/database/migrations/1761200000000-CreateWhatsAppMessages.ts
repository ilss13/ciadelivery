import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWhatsAppMessages1761200000000 implements MigrationInterface {
  name = 'CreateWhatsAppMessages1761200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`message_templates\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`key\` varchar(64) NOT NULL,
        \`language\` varchar(16) NOT NULL DEFAULT 'pt_BR',
        \`meta_template_name\` varchar(64) NOT NULL,
        \`enabled\` tinyint(1) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_message_templates_tenant_key\` (\`tenant_id\`, \`key\`),
        CONSTRAINT \`fk_message_templates_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`whatsapp_messages\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`direction\` varchar(8) NOT NULL,
        \`to_phone\` varchar(32) NOT NULL,
        \`template_key\` varchar(64) NOT NULL,
        \`body\` text NOT NULL,
        \`status\` varchar(16) NOT NULL,
        \`provider_message_id\` varchar(128) NULL,
        \`event_id\` char(36) NOT NULL,
        \`last_error\` varchar(500) NULL,
        \`created_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_whatsapp_messages_event_id\` (\`event_id\`),
        KEY \`idx_whatsapp_messages_template\` (\`tenant_id\`, \`template_key\`, \`created_at\`),
        CONSTRAINT \`fk_whatsapp_messages_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`chk_whatsapp_messages_direction\` CHECK (\`direction\` IN ('OUT', 'IN')),
        CONSTRAINT \`chk_whatsapp_messages_status\` CHECK (\`status\` IN ('QUEUED', 'SENT', 'FAILED', 'SKIPPED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `whatsapp_messages`');
    await queryRunner.query('DROP TABLE `message_templates`');
  }
}
