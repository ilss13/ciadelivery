import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

export async function publishStoreForTests(
  app: INestApplication,
  tenantId: string,
): Promise<void> {
  await app
    .get(DataSource)
    .query('UPDATE `stores` SET `published` = 1 WHERE `tenant_id` = ?', [
      tenantId,
    ]);
}
