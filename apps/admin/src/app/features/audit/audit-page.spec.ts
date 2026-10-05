import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuditPage } from './audit-page';
import { formatAuditDate, formatChanges } from './audit-messages';

describe('AuditPage', () => {
  it('explains an empty trail', async () => {
    const fixture = create();
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((candidate) =>
      candidate.url.includes('/api/v1/admin/audit-logs'),
    ).flush({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Nenhuma ação sensível neste filtro.',
    );
    http.verify();
  });

  it('shows the change in São Paulo time', async () => {
    const fixture = create();
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((candidate) =>
      candidate.url.includes('/api/v1/admin/audit-logs'),
    ).flush({
      data: [
        {
          id: 'log-1',
          actorId: 'attendant-1',
          action: 'order.cancelled',
          entityType: 'order',
          entityId: 'order-1',
          changes: { status: 'CANCELLED' },
          createdAt: '2026-10-05T15:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Pedido cancelado');
    expect(text).toContain(formatAuditDate('2026-10-05T15:00:00.000Z'));
    expect(text).toContain('12:00');
    expect(fixture.nativeElement.textContent).toContain(
      formatChanges({ status: 'CANCELLED' }),
    );
    http.verify();
  });
});

function create() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  return TestBed.createComponent(AuditPage);
}
