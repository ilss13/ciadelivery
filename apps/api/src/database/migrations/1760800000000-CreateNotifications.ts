import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1760800000000 implements MigrationInterface {
  name = 'CreateNotifications1760800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`notifications\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`store_id\` char(36) NOT NULL,
        \`type\` varchar(64) NOT NULL,
        \`title\` varchar(160) NOT NULL,
        \`body\` varchar(500) NOT NULL,
        \`order_id\` char(36) NULL,
        \`event_id\` char(36) NULL,
        \`read_at\` datetime(3) NULL,
        \`created_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_notifications_event_id\` (\`event_id\`),
        KEY \`idx_notifications_store_created\` (\`tenant_id\`, \`store_id\`, \`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `notifications`');
  }
}
