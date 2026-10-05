import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOutbox1760700000000 implements MigrationInterface {
  name = 'CreateOutbox1760700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`outbox_events\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`aggregate_type\` varchar(32) NOT NULL,
        \`aggregate_id\` char(36) NOT NULL,
        \`type\` varchar(64) NOT NULL,
        \`payload\` json NOT NULL,
        \`status\` varchar(16) NOT NULL,
        \`attempts\` int unsigned NOT NULL DEFAULT 0,
        \`available_at\` datetime(3) NOT NULL,
        \`processed_at\` datetime(3) NULL,
        \`last_error\` varchar(500) NULL,
        \`locked_by\` char(36) NULL,
        \`created_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_outbox_events_status_available\` (\`status\`, \`available_at\`),
        CONSTRAINT \`chk_outbox_events_status\` CHECK (\`status\` IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`processed_events\` (
        \`event_id\` char(36) NOT NULL,
        \`handler\` varchar(64) NOT NULL,
        \`processed_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`event_id\`, \`handler\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `processed_events`');
    await queryRunner.query('DROP TABLE IF EXISTS `outbox_events`');
  }
}
