import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenAnonymizedPhones1761600000000 implements MigrationInterface {
  name = 'WidenAnonymizedPhones1761600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `customers` MODIFY `phone` varchar(64) NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `orders` MODIFY `customer_phone` varchar(64) NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `orders` MODIFY `customer_phone` varchar(16) NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `customers` MODIFY `phone` varchar(16) NOT NULL',
    );
  }
}
