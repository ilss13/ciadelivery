import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  OUTBOX_STORE,
  OutboxHandler,
  OutboxPoller,
  OutboxStore,
  OutboxWorkerModule,
  ProcessOutboxEvent,
  RequeueOutbox,
} from '@ciadelivery/orders/worker';
import { loadEnvFile, DatabaseReady, PlatformModule } from '@ciadelivery/shared';
import { DataSource } from 'typeorm';
import { createWorkerApplication } from './bootstrap';

class FailingHandler implements OutboxHandler {
  readonly name = 'failing';
  private seen = 0;

  constructor(private readonly failures: number) {}

  supports(type: string): boolean {
    return type === 'test.fail';
  }

  async handle(): Promise<void> {
    this.seen += 1;
    if (this.seen <= this.failures) {
      throw new Error('The test handler failed');
    }
  }
}

describe('outbox worker', () => {
  const envSnapshot = { ...process.env };

  beforeAll(() => {
    loadEnvFile();
    process.env['NODE_ENV'] = 'local';
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in envSnapshot)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, envSnapshot);
  });

  it('processes a pending event once', async () => {
    const worker = await createWorkerApplication();
    await worker.init();
    await worker.get(DatabaseReady).ensure();
    const dataSource = worker.get(DataSource);
    const eventId = randomUUID();
    try {
      await insertEvent(dataSource, eventId, 'order.created');
      await waitUntil(async () => (await readEvent(dataSource, eventId)).status === 'PROCESSED');
      expect(await processedCount(dataSource, eventId)).toBe(1);

      const poller = worker.get(OutboxPoller);
      const processor = worker.get(ProcessOutboxEvent);
      await poller.pollOnce();
      await processor.execute(eventId);
      expect(await processedCount(dataSource, eventId)).toBe(1);

      await dataSource.query(
        `UPDATE outbox_events SET status = 'PROCESSING', locked_by = NULL WHERE id = ?`,
        [eventId],
      );
      await processor.execute(eventId);
      expect(await processedCount(dataSource, eventId)).toBe(1);
      expect((await readEvent(dataSource, eventId)).status).toBe('PROCESSED');
    } finally {
      await dataSource.query(`DELETE FROM processed_events WHERE event_id = ?`, [eventId]);
      await dataSource.query(`DELETE FROM outbox_events WHERE id = ?`, [eventId]);
      await closeWorker(worker);
    }
  });

  it('fails the handler until FAILED and processes again after requeue', async () => {
    const failing = new FailingHandler(5);
    const moduleRef = await Test.createTestingModule({
      imports: [
        PlatformModule,
        OutboxWorkerModule.register({
          backoffMs: () => 0,
          pollIntervalMs: 0,
          extraHandlers: [failing],
        }),
      ],
    }).compile();
    const worker = moduleRef.createNestApplication();
    await worker.init();
    await worker.get(DatabaseReady).ensure();
    const dataSource = worker.get(DataSource);
    const eventId = randomUUID();
    try {
      await insertEvent(dataSource, eventId, 'test.fail');
      const poller = worker.get(OutboxPoller);
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await poller.pollOnce();
        await waitUntil(async () => Number((await readEvent(dataSource, eventId)).attempts) >= attempt);
      }
      const failed = await readEvent(dataSource, eventId);
      expect(failed.status).toBe('FAILED');
      expect(Number(failed.attempts)).toBe(5);
      expect(await processedCount(dataSource, eventId)).toBe(0);

      const outbox = worker.get<OutboxStore>(OUTBOX_STORE);
      await new RequeueOutbox(outbox).execute(eventId);
      await poller.pollOnce();
      await waitUntil(async () => (await readEvent(dataSource, eventId)).status === 'PROCESSED');
      expect(await processedCount(dataSource, eventId)).toBe(1);

      await dataSource.query(
        `UPDATE outbox_events SET status = 'PROCESSING', locked_by = NULL WHERE id = ?`,
        [eventId],
      );
      await worker.get(ProcessOutboxEvent).execute(eventId);
      expect(await processedCount(dataSource, eventId)).toBe(1);
    } finally {
      await dataSource.query(`DELETE FROM processed_events WHERE event_id = ?`, [eventId]);
      await dataSource.query(`DELETE FROM outbox_events WHERE id = ?`, [eventId]);
      await closeWorker(worker);
    }
  });
});

async function insertEvent(
  dataSource: DataSource,
  id: string,
  type: string,
): Promise<void> {
  const now = new Date();
  await dataSource.query(
    `INSERT INTO outbox_events (
       id, tenant_id, aggregate_type, aggregate_id, type, payload, status,
       attempts, available_at, processed_at, last_error, locked_by, created_at
     ) VALUES (?, ?, 'order', ?, ?, ?, 'PENDING', 0, ?, NULL, NULL, NULL, ?)`,
    [
      id,
      randomUUID(),
      randomUUID(),
      type,
      JSON.stringify({
        orderId: randomUUID(),
        orderNumber: 1,
        status: 'NEW',
        fulfillment: 'PICKUP',
      }),
      now,
      now,
    ],
  );
}

async function waitUntil(read: () => Promise<boolean>): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    if (await read()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error('The outbox event was not processed in time');
}

async function readEvent(
  dataSource: DataSource,
  id: string,
): Promise<{ status: string; attempts: number | string }> {
  const rows: Array<{ status: string; attempts: number | string }> =
    await dataSource.query(
      `SELECT status, attempts FROM outbox_events WHERE id = ?`,
      [id],
    );
  const row = rows[0];
  if (row === undefined) {
    throw new Error('The outbox event was not stored');
  }
  return row;
}

async function processedCount(
  dataSource: DataSource,
  eventId: string,
): Promise<number> {
  const rows: Array<{ total: number | string }> = await dataSource.query(
    `SELECT COUNT(*) AS total FROM processed_events WHERE event_id = ?`,
    [eventId],
  );
  return Number(rows[0]?.total ?? 0);
}

async function closeWorker(worker: INestApplication): Promise<void> {
  const dataSource = worker.get(DataSource);
  await worker.close();
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
}
