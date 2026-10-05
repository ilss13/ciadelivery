import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

const JOB_QUEUES = ['outbox-events', 'whatsapp-outbound'] as const;

export const METRIC_COUNTERS = [
  'orders_created',
  'whatsapp_messages_sent',
  'whatsapp_messages_failed',
  'jobs_failed',
  'jobs_retried',
] as const;

export type MetricCounter = (typeof METRIC_COUNTERS)[number];

interface HttpSample {
  method: string;
  route: string;
  status: string;
  count: number;
  sum: number;
  buckets: number[];
}

const httpSamples = new Map<string, HttpSample>();

type MetricSink = (name: MetricCounter, field?: string) => void;

let sink: MetricSink = () => undefined;

export function bindMetricSink(next: MetricSink): void {
  sink = next;
}

export function observeCounter(name: MetricCounter, field?: string): void {
  try {
    sink(name, field);
  } catch {
    return;
  }
}

export function recordHttp(
  method: string,
  route: string,
  status: number,
  seconds: number,
): void {
  const sampleMethod = method.toUpperCase();
  const sampleStatus = String(status);
  const key = `${sampleMethod}|${route}|${sampleStatus}`;
  const current = httpSamples.get(key) ?? {
    method: sampleMethod,
    route,
    status: sampleStatus,
    count: 0,
    sum: 0,
    buckets: DURATION_BUCKETS.map(() => 0),
  };
  current.count += 1;
  current.sum += seconds;
  for (let index = 0; index < DURATION_BUCKETS.length; index += 1) {
    const bound = DURATION_BUCKETS[index] ?? Number.POSITIVE_INFINITY;
    if (seconds <= bound) {
      const bucket = current.buckets[index] ?? 0;
      current.buckets[index] = bucket + 1;
      break;
    }
  }
  httpSamples.set(key, current);
}

export function resetHttpMetrics(): void {
  httpSamples.clear();
}

export function httpRouteLabel(request: {
  baseUrl?: string;
  route?: { path?: string };
}): string {
  const template = request.route?.path;
  if (typeof template !== 'string' || template.length === 0) {
    return 'unmatched';
  }
  const base = typeof request.baseUrl === 'string' ? request.baseUrl : '';
  const combined =
    base.length > 0 && !template.startsWith(base) ? `${base}${template}` : template;
  const collapsed = combined.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
    ':id',
  );
  if (!/^\/[A-Za-z0-9_./:-]*$/.test(collapsed)) {
    return 'unmatched';
  }
  return collapsed;
}

export function httpMetricsMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const started = process.hrtime.bigint();
  response.on('finish', () => {
    const seconds = Number(process.hrtime.bigint() - started) / 1e9;
    recordHttp(
      request.method,
      httpRouteLabel(request),
      response.statusCode,
      seconds,
    );
  });
  next();
}

export function metricsAuthorized(
  authorization: string | undefined,
  expectedToken: string | null,
): boolean {
  if (expectedToken === null) {
    return true;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(authorization?.trim() ?? '');
  const provided = match?.[1];
  if (provided === undefined) {
    return false;
  }
  const left = createHash('sha256').update(provided).digest();
  const right = createHash('sha256').update(expectedToken).digest();
  return timingSafeEqual(left, right);
}

export interface PrometheusSnapshot {
  ordersCreated: number;
  whatsappSent: number;
  whatsappFailed: number;
  jobsFailed: Record<string, number>;
  jobsRetried: Record<string, number>;
  outboxPending: number;
  outboxFailed: number;
  mysqlUp: number;
  redisUp: number;
}

export function renderPrometheus(snapshot: PrometheusSnapshot): string {
  const lines: string[] = [];
  lines.push(
    '# HELP http_requests_total HTTP responses by route template and status',
  );
  lines.push('# TYPE http_requests_total counter');
  lines.push(
    '# HELP http_request_duration_seconds HTTP response latency by route template and status',
  );
  lines.push('# TYPE http_request_duration_seconds histogram');
  for (const sample of [...httpSamples.values()].sort(compareHttp)) {
    const labels = `method="${escapeLabel(sample.method)}",route="${escapeLabel(sample.route)}",status="${escapeLabel(sample.status)}"`;
    lines.push(`http_requests_total{${labels}} ${sample.count}`);
    let cumulative = 0;
    for (let index = 0; index < DURATION_BUCKETS.length; index += 1) {
      cumulative += sample.buckets[index] ?? 0;
      lines.push(
        `http_request_duration_seconds_bucket{${labels},le="${DURATION_BUCKETS[index]}"} ${cumulative}`,
      );
    }
    lines.push(
      `http_request_duration_seconds_bucket{${labels},le="+Inf"} ${sample.count}`,
    );
    lines.push(`http_request_duration_seconds_sum{${labels}} ${formatNumber(sample.sum)}`);
    lines.push(`http_request_duration_seconds_count{${labels}} ${sample.count}`);
  }
  lines.push('# HELP orders_created_total Orders created');
  lines.push('# TYPE orders_created_total counter');
  lines.push(`orders_created_total ${snapshot.ordersCreated}`);
  lines.push('# HELP whatsapp_messages_sent_total WhatsApp messages sent');
  lines.push('# TYPE whatsapp_messages_sent_total counter');
  lines.push(`whatsapp_messages_sent_total ${snapshot.whatsappSent}`);
  lines.push('# HELP whatsapp_messages_failed_total WhatsApp messages failed');
  lines.push('# TYPE whatsapp_messages_failed_total counter');
  lines.push(`whatsapp_messages_failed_total ${snapshot.whatsappFailed}`);
  lines.push('# HELP jobs_failed_total Background jobs that reached a terminal failure');
  lines.push('# TYPE jobs_failed_total counter');
  lines.push('# HELP jobs_retried_total Background job retries');
  lines.push('# TYPE jobs_retried_total counter');
  for (const queue of JOB_QUEUES) {
    lines.push(
      `jobs_failed_total{queue="${queue}"} ${snapshot.jobsFailed[queue] ?? 0}`,
    );
    lines.push(
      `jobs_retried_total{queue="${queue}"} ${snapshot.jobsRetried[queue] ?? 0}`,
    );
  }
  lines.push('# HELP outbox_events Outbox rows waiting or failed');
  lines.push('# TYPE outbox_events gauge');
  lines.push(`outbox_events{state="pending"} ${snapshot.outboxPending}`);
  lines.push(`outbox_events{state="failed"} ${snapshot.outboxFailed}`);
  lines.push('# HELP mysql_up MySQL readiness, 1 when the check passed');
  lines.push('# TYPE mysql_up gauge');
  lines.push(`mysql_up ${snapshot.mysqlUp}`);
  lines.push('# HELP redis_up Redis readiness, 1 when the check passed');
  lines.push('# TYPE redis_up gauge');
  lines.push(`redis_up ${snapshot.redisUp}`);
  return `${lines.join('\n')}\n`;
}

function compareHttp(left: HttpSample, right: HttpSample): number {
  return `${left.method}|${left.route}|${left.status}`.localeCompare(
    `${right.method}|${right.route}|${right.status}`,
  );
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return String(Math.round(value * 1e9) / 1e9);
}
