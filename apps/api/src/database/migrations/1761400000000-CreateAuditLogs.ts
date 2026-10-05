import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogs1761400000000 implements MigrationInterface {
  name = 'CreateAuditLogs1761400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`audit_logs\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NULL,
        \`actor_id\` char(36) NULL,
        \`actor_type\` varchar(20) NOT NULL,
        \`action\` varchar(64) NOT NULL,
        \`entity_type\` varchar(64) NOT NULL,
        \`entity_id\` varchar(64) NOT NULL,
        \`before\` json NULL,
        \`changes\` json NULL,
        \`ip\` varchar(64) NULL,
        \`user_agent\` varchar(512) NULL,
        \`created_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_audit_logs_tenant_created\` (\`tenant_id\`, \`created_at\`),
        KEY \`idx_audit_logs_tenant_entity\` (\`tenant_id\`, \`entity_type\`, \`entity_id\`),
        CONSTRAINT \`fk_audit_logs_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`chk_audit_logs_actor_type\` CHECK (\`actor_type\` IN ('USER', 'SYSTEM', 'SUPER_ADMIN'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `audit_logs`');
  }
}
