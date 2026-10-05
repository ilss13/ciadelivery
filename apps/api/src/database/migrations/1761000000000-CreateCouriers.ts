import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCouriers1761000000000 implements MigrationInterface {
  name = 'CreateCouriers1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`couriers\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`store_id\` char(36) NOT NULL,
        \`user_id\` char(36) NOT NULL,
        \`name\` varchar(160) NOT NULL,
        \`phone\` varchar(32) NOT NULL,
        \`status\` varchar(20) NOT NULL,
        \`active\` tinyint NOT NULL,
        \`vehicle_type\` varchar(40) NULL,
        \`notes\` varchar(280) NULL,
        \`created_at\` datetime(3) NOT NULL,
        \`updated_at\` datetime(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_couriers_user_id\` (\`user_id\`),
        KEY \`idx_couriers_store\` (\`tenant_id\`, \`store_id\`, \`active\`),
        CONSTRAINT \`fk_couriers_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_couriers_store_id\` FOREIGN KEY (\`store_id\`) REFERENCES \`stores\` (\`id\`),
        CONSTRAINT \`fk_couriers_user_id\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`),
        CONSTRAINT \`chk_couriers_status\` CHECK (\`status\` IN ('AVAILABLE', 'UNAVAILABLE')),
        CONSTRAINT \`chk_couriers_active\` CHECK (\`active\` IN (0, 1))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE \`delivery_assignments\` (
        \`id\` char(36) NOT NULL,
        \`tenant_id\` char(36) NOT NULL,
        \`order_id\` char(36) NOT NULL,
        \`courier_id\` char(36) NOT NULL,
        \`status\` varchar(20) NOT NULL,
        \`assigned_by\` char(36) NOT NULL,
        \`assigned_at\` datetime(3) NOT NULL,
        \`out_at\` datetime(3) NULL,
        \`delivered_at\` datetime(3) NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_delivery_assignments_order_id\` (\`order_id\`),
        KEY \`idx_delivery_assignments_courier\` (\`tenant_id\`, \`courier_id\`, \`status\`),
        CONSTRAINT \`fk_delivery_assignments_tenant_id\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`),
        CONSTRAINT \`fk_delivery_assignments_order_id\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`),
        CONSTRAINT \`fk_delivery_assignments_courier_id\` FOREIGN KEY (\`courier_id\`) REFERENCES \`couriers\` (\`id\`),
        CONSTRAINT \`fk_delivery_assignments_assigned_by\` FOREIGN KEY (\`assigned_by\`) REFERENCES \`users\` (\`id\`),
        CONSTRAINT \`chk_delivery_assignments_status\` CHECK (\`status\` IN ('ASSIGNED', 'OUT', 'DELIVERED', 'CANCELLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `delivery_assignments`');
    await queryRunner.query('DROP TABLE `couriers`');
  }
}
