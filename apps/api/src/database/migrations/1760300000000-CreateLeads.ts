import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLeads1760300000000 implements MigrationInterface {
  name = 'CreateLeads1760300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`leads\` (
        \`id\` char(36) NOT NULL,
        \`name\` varchar(160) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`phone\` varchar(20) NOT NULL,
        \`establishment_name\` varchar(160) NOT NULL,
        \`created_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `leads`');
  }
}
