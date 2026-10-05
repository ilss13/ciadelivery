import {
  httpRouteLabel,
  metricsAuthorized,
  recordHttp,
  renderPrometheus,
  resetHttpMetrics,
} from './prometheus';

describe('prometheus metrics', () => {
  afterEach(() => {
    resetHttpMetrics();
  });

  it('counts http by route template and drops raw ids', () => {
    expect(
      httpRouteLabel({
        baseUrl: '/api/v1/admin/orders',
        route: {
          path: '/8f1b2c3d-4e5f-4678-89ab-1234567890ab/accept',
        },
      }),
    ).toBe('/api/v1/admin/orders/:id/accept');
    expect(httpRouteLabel({})).toBe('unmatched');

    recordHttp('GET', '/health', 200, 0.01);
    const body = renderPrometheus(emptySnapshot());
    expect(body).toContain(
      'http_requests_total{method="GET",route="/health",status="200"} 1',
    );
    expect(body).toContain('le="+Inf"} 1');
    expect(body).not.toContain('8f1b2c3d');
  });

  it('exposes dependency, outbox, job and message series without a tenant label', () => {
    const body = renderPrometheus({
      ...emptySnapshot(),
      ordersCreated: 2,
      whatsappSent: 1,
      outboxFailed: 3,
      mysqlUp: 1,
      redisUp: 0,
      jobsRetried: { 'whatsapp-outbound': 4 },
    });
    expect(body).toContain('orders_created_total 2');
    expect(body).toContain('whatsapp_messages_sent_total 1');
    expect(body).toContain('whatsapp_messages_failed_total 0');
    expect(body).toContain('outbox_events{state="failed"} 3');
    expect(body).toContain('outbox_events{state="pending"} 0');
    expect(body).toContain('jobs_retried_total{queue="whatsapp-outbound"} 4');
    expect(body).toContain('jobs_failed_total{queue="outbox-events"} 0');
    expect(body).toContain('mysql_up 1');
    expect(body).toContain('redis_up 0');
    expect(body).not.toContain('tenant');
  });

  it('accepts the metrics token only as a bearer secret', () => {
    expect(metricsAuthorized(undefined, null)).toBe(true);
    expect(metricsAuthorized(undefined, 'secret')).toBe(false);
    expect(metricsAuthorized('Bearer secret', 'secret')).toBe(true);
    expect(metricsAuthorized('Bearer other', 'secret')).toBe(false);
  });
});

function emptySnapshot() {
  return {
    ordersCreated: 0,
    whatsappSent: 0,
    whatsappFailed: 0,
    jobsFailed: {},
    jobsRetried: {},
    outboxPending: 0,
    outboxFailed: 0,
    mysqlUp: 0,
    redisUp: 0,
  };
}
