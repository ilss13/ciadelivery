import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DeliverySettingsSection } from './delivery-settings';

describe('DeliverySettingsSection', () => {
  it('shows the overlap error returned by the API', async () => {
    const fixture = create();
    await flushLoad(fixture);

    const inputs = [
      ...fixture.nativeElement.querySelectorAll('input'),
    ] as HTMLInputElement[];
    const toKm = inputs.find((input) => input.value === '3');
    expect(toKm).toBeDefined();
    if (toKm === undefined) {
      return;
    }
    toKm.value = '6';
    toKm.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const save = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: HTMLButtonElement) => button.textContent?.includes('Salvar entrega'),
    ) as HTMLButtonElement;
    save.click();
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne(
      (candidate) =>
        candidate.url.includes('/api/v1/admin/delivery/config') &&
        candidate.method === 'PUT',
    );
    expect(request.request.body.zones).toEqual([
      { fromKm: 0, toKm: 6, feeCents: 500 },
      { fromKm: 3, toKm: 8, feeCents: 700 },
    ]);
    request.flush(
      { error: { code: 'DELIVERY_ZONES_OVERLAP' } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'As faixas de distância se sobrepõem.',
    );
    http.verify();
  });
});

function create() {
  TestBed.configureTestingModule({
    imports: [DeliverySettingsSection],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  return TestBed.createComponent(DeliverySettingsSection);
}

async function flushLoad(fixture: ReturnType<typeof create>): Promise<void> {
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  http
    .expectOne((candidate) =>
      candidate.url.includes('/api/v1/admin/delivery/config'),
    )
    .flush({
      deliveryEnabled: true,
      pickupEnabled: true,
      maxRadiusKm: 8,
      feeMode: 'ZONE',
      flatFeeCents: 0,
      estimatedMinutes: 40,
      originLatitude: null,
      originLongitude: null,
    });
  http
    .expectOne((candidate) =>
      candidate.url.includes('/api/v1/admin/delivery/zones'),
    )
    .flush({
      zones: [
        { id: 'a', fromKm: 0, toKm: 3, feeCents: 500, sortOrder: 0 },
        { id: 'b', fromKm: 3, toKm: 8, feeCents: 700, sortOrder: 1 },
      ],
    });
  await fixture.whenStable();
  fixture.detectChanges();
}
