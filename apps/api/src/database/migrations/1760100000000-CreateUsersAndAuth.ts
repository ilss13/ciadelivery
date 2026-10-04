import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersAndAuth1760100000000 implements MigrationInterface {
  name = 'CreateUsersAndAuth1760100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`users\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NULL,
        \`store_id\` char(36) NULL,
        \`name\` varchar(160) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`password_hash\` varchar(255) NOT NULL,
        \`role\` varchar(20) NOT NULL,
        \`status\` varchar(20) NOT NULL,
        \`created_at\` datetime(3) NOT NULL,
        \`updated_at\` datetime(3) NOT NULL,
        \`owner_tenant_id\` char(36) AS (IF(\`role\` = 'OWNER', \`tenant_id\`, NULL)) STORED,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_users_email\` (\`email\`),
        UNIQUE KEY \`uq_users_owner_tenant\` (\`owner_tenant_id\`),
        KEY \`idx_users_tenant_id\` (\`tenant_id\`),
        CONSTRAINT \`fk_users_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_users_store_id\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`),
        CONSTRAINT \`chk_users_role_scope\` CHECK (
          (\`role\` = 'SUPER_ADMIN' AND \`tenant_id\` IS NULL AND \`store_id\` IS NULL)
          OR (\`role\` <> 'SUPER_ADMIN' AND \`tenant_id\` IS NOT NULL AND \`store_id\` IS NOT NULL)
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`user_permission_overrides\` (
        \`user_id\` char(36) NOT NULL,
        \`permission\` varchar(64) NOT NULL,
        \`granted\` tinyint NOT NULL,
        PRIMARY KEY (\`user_id\`, \`permission\`),
        CONSTRAINT \`fk_user_permission_overrides_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`refresh_tokens\` (
        \`id\` char(36) NOT NULL,
        \`user_id\` char(36) NOT NULL,
        \`token_hash\` char(64) NOT NULL,
        \`family_id\` char(36) NOT NULL,
        \`expires_at\` datetime(3) NOT NULL,
        \`revoked_at\` datetime(3) NULL,
        \`replaced_by_id\` char(36) NULL,
        \`created_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_refresh_tokens_token_hash\` (\`token_hash\`),
        KEY \`idx_refresh_tokens_family_id\` (\`family_id\`),
        KEY \`idx_refresh_tokens_user_id\` (\`user_id\`),
        CONSTRAINT \`fk_refresh_tokens_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`login_attempts\` (
        \`id\` char(36) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`ip\` varchar(64) NOT NULL,
        \`succeeded\` tinyint NOT NULL,
        \`created_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_login_attempts_email_created_at\` (\`email\`, \`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`password_reset_tokens\` (
        \`id\` char(36) NOT NULL,
        \`user_id\` char(36) NOT NULL,
        \`token_hash\` char(64) NOT NULL,
        \`expires_at\` datetime(3) NOT NULL,
        \`used_at\` datetime(3) NULL,
        \`created_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_password_reset_tokens_token_hash\` (\`token_hash\`),
        KEY \`idx_password_reset_tokens_user_id\` (\`user_id\`),
        CONSTRAINT \`fk_password_reset_tokens_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `password_reset_tokens`');
    await queryRunner.query('DROP TABLE IF EXISTS `login_attempts`');
    await queryRunner.query('DROP TABLE IF EXISTS `refresh_tokens`');
    await queryRunner.query('DROP TABLE IF EXISTS `user_permission_overrides`');
    await queryRunner.query('DROP TABLE IF EXISTS `users`');
  }
}
