import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { APP_CONFIG, AppConfig } from '../app-config';
import { HealthService } from '../health/health.service';
import {
  METRIC_COUNTERS,
  MetricCounter,
  bindMetricSink,
  renderPrometheus,
} from './prometheus';

const LABELED = new Set<MetricCounter>(['jobs_failed', 'jobs_retried']);

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly health: HealthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    this.redis = new Redis({
      host: this.config.redisHost,
      port: this.config.redisPort,
      lazyConnect: true,
      connectTimeout: 1500,
      commandTimeout: 1500,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    const client = this.redis;
    bindMetricSink((name, field) => {
      if (LABELED.has(name)) {
        if (field === undefined) {
          return;
        }
        void client.hincrby(redisKey(name), field, 1).catch(() => undefined);
        return;
      }
      void client.incr(redisKey(name)).catch(() => undefined);
    });
  }

  async onModuleDestroy(): Promise<void> {
    bindMetricSink(() => undefined);
    this.redis?.disconnect();
    this.redis = null;
  }

  async render(): Promise<string> {
    const [counters, jobsFailed, jobsRetried, outbox, probes] = await Promise.all([
      this.readCounters(),
      this.readHash('jobs_failed'),
      this.readHash('jobs_retried'),
      this.readOutbox(),
      this.health.readiness(),
    ]);
    return renderPrometheus({
      ordersCreated: counters['orders_created'] ?? 0,
      whatsappSent: counters['whatsapp_messages_sent'] ?? 0,
      whatsappFailed: counters['whatsapp_messages_failed'] ?? 0,
      jobsFailed,
      jobsRetried,
      outboxPending: outbox.pending,
      outboxFailed: outbox.failed,
      mysqlUp: probes.mysql ? 1 : 0,
      redisUp: probes.redis ? 1 : 0,
    });
  }

  private async readCounters(): Promise<Partial<Record<MetricCounter, number>>> {
    const client = this.redis;
    if (client === null) {
      return {};
    }
    const values: Partial<Record<MetricCounter, number>> = {};
    await Promise.all(
      METRIC_COUNTERS.filter((name) => !LABELED.has(name)).map(async (name) => {
        values[name] = await readNumber(client.get(redisKey(name)));
      }),
    );
    return values;
  }

  private async readHash(name: MetricCounter): Promise<Record<string, number>> {
    const client = this.redis;
    if (client === null) {
      return {};
    }
    try {
      const raw = await client.hgetall(redisKey(name));
      const parsed: Record<string, number> = {};
      for (const [field, value] of Object.entries(raw)) {
        parsed[field] = Number(value) || 0;
      }
      return parsed;
    } catch {
      return {};
    }
  }

  private async readOutbox(): Promise<{ pending: number; failed: number }> {
    try {
      if (!this.dataSource.isInitialized) {
        return { pending: 0, failed: 0 };
      }
      const rows: Array<{ status: string; total: number | string }> =
        await this.dataSource.query(
          `SELECT status, COUNT(*) AS total
           FROM outbox_events
           WHERE status IN ('PENDING', 'FAILED')
           GROUP BY status`,
        );
      let pending = 0;
      let failed = 0;
      for (const row of rows) {
        const total = Number(row.total) || 0;
        if (row.status === 'PENDING') {
          pending = total;
        }
        if (row.status === 'FAILED') {
          failed = total;
        }
      }
      return { pending, failed };
    } catch {
      return { pending: 0, failed: 0 };
    }
  }
}

function redisKey(name: string): string {
  return `ciadelivery:metrics:${name}`;
}

async function readNumber(pending: Promise<string | null>): Promise<number> {
  try {
    const value = await pending;
    return value === null ? 0 : Number(value) || 0;
  } catch {
    return 0;
  }
}
