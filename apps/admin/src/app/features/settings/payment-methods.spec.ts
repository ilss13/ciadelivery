import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PaymentMethodsSection } from './payment-methods';

const methods = [
  {
    code: 'CASH',
    label: 'Dinheiro',
    instructions: null,
    enabled: true,
    sortOrder: 0,
  },
  {
    code: 'PIX_MANUAL',
    label: 'PIX',
    instructions: null,
    enabled: false,
    sortOrder: 2,
  },
];

describe('PaymentMethodsSection', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('asks before saving when every method would be disabled', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const fixture = create();
    await flushLoad(fixture);

    const checkbox = fixture.nativeElement.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const save = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: HTMLButtonElement) =>
        button.textContent?.includes('Salvar pagamentos'),
    ) as HTMLButtonElement;
    save.click();

    expect(confirm).toHaveBeenCalled();
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows the API error when the last method is disabled', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = create();
    await flushLoad(fixture);

    const checkbox = fixture.nativeElement.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const save = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: HTMLButtonElement) =>
        button.textContent?.includes('Salvar pagamentos'),
    ) as HTMLButtonElement;
    save.click();
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne((candidate) =>
      candidate.url.includes('/api/v1/admin/payment-methods'),
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.methods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CASH', enabled: false }),
      ]),
    );
    request.flush(
      { error: { code: 'PAYMENT_METHOD_REQUIRED' } },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Mantenha pelo menos uma forma de pagamento ativa.',
    );
    http.verify();
  });
});

function create() {
  TestBed.configureTestingModule({
    imports: [PaymentMethodsSection],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  return TestBed.createComponent(PaymentMethodsSection);
}

async function flushLoad(
  fixture: ReturnType<typeof create>,
): Promise<void> {
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  const request = http.expectOne((candidate) =>
    candidate.url.includes('/api/v1/admin/payment-methods'),
  );
  request.flush({ methods });
  await fixture.whenStable();
  fixture.detectChanges();
}
