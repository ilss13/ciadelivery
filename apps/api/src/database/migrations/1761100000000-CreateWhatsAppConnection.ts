import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWhatsAppConnection1761100000000 implements MigrationInterface {
  name = 'CreateWhatsAppConnection1761100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`whatsapp_connections\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`store_id\` char(36) NOT NULL,
        \`provider\` varchar(20) NOT NULL,
        \`phone_number\` varchar(32) NOT NULL,
        \`business_account_id\` varchar(64) NOT NULL,
        \`phone_number_id\` varchar(64) NOT NULL,
        \`status\` varchar(20) NOT NULL,
        \`encrypted_credentials\` text NULL,
        \`connected_at\` datetime(3) NULL,
        \`disconnected_at\` datetime(3) NULL,
        \`created_at\` datetime(3) NOT NULL,
        \`updated_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_whatsapp_connections_store_id\` (\`store_id\`),
        KEY \`idx_whatsapp_connections_phone\` (\`phone_number_id\`, \`status\`),
        CONSTRAINT \`fk_whatsapp_connections_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_whatsapp_connections_store_id\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`),
        CONSTRAINT \`chk_whatsapp_connections_provider\` CHECK (\`provider\` IN ('META_CLOUD')),
        CONSTRAINT \`chk_whatsapp_connections_status\` CHECK (\`status\` IN ('PENDING', 'CONNECTED', 'DISCONNECTED', 'ERROR'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`whatsapp_webhook_events\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`external_id\` varchar(255) NOT NULL,
        \`payload\` json NOT NULL,
        \`received_at\` datetime(3) NOT NULL,
        \`processed_at\` datetime(3) NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_whatsapp_webhook_events_external_id\` (\`external_id\`),
        KEY \`idx_whatsapp_webhook_events_tenant\` (\`tenant_id\`, \`received_at\`),
        CONSTRAINT \`fk_whatsapp_webhook_events_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `whatsapp_webhook_events`');
    await queryRunner.query('DROP TABLE `whatsapp_connections`');
  }
}
