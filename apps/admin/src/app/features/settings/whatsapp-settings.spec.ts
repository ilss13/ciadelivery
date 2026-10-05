import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WhatsAppSettingsSection } from './whatsapp-settings';

describe('WhatsAppSettingsSection', () => {

  it('explains the official API and connects without showing the token', async () => {
    const fixture = create();
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushConnection(http, { error: { code: 'WHATSAPP_CONNECTION_NOT_FOUND' } }, 404);
    flushTemplates(http, []);
    flushSends(http, []);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('API oficial da Meta');
    expect(fixture.nativeElement.textContent).toContain('próprio número');

    fill(fixture, 'Número exibido', '+5511988887777');
    fill(fixture, 'ID da conta business', '102290129340398');
    fill(fixture, 'ID do número', '106540352242922');
    fill(fixture, 'Token de acesso', 'super-secret-token-value');
    click(fixture, 'Conectar');

    const posted = http.expectOne(
      (candidate) =>
        candidate.url.includes('/api/v1/admin/whatsapp/connect') &&
        candidate.method === 'POST',
    );
    expect(posted.request.body.accessToken).toBe('super-secret-token-value');
    posted.flush({
      phoneNumber: '+5511988887777',
      businessAccountId: '102290129340398',
      phoneNumberId: '106540352242922',
      status: 'CONNECTED',
      credentialsHint: 'alue',
    });
    flushTemplates(http, []);
    flushSends(http, []);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Conectado');
    expect(fixture.nativeElement.textContent).toContain('••••alue');
    expect(fixture.nativeElement.textContent).not.toContain(
      'super-secret-token-value',
    );
    http.verify();
  });

  it('asks before disconnecting', async () => {
    const fixture = create();
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushConnection(http, {
      phoneNumber: '+5511988887777',
      businessAccountId: '102290129340398',
      phoneNumberId: '106540352242922',
      status: 'CONNECTED',
      credentialsHint: 'alue',
    });
    flushTemplates(http, []);
    flushSends(http, []);
    await fixture.whenStable();
    fixture.detectChanges();

    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    click(fixture, 'Desconectar');
    expect(confirm).toHaveBeenCalled();
    http.expectNone(
      (candidate) =>
        candidate.method === 'DELETE' &&
        candidate.url.includes('/api/v1/admin/whatsapp/connection'),
    );

    confirm.mockReturnValue(true);
    click(fixture, 'Desconectar');
    const deleted = http.expectOne(
      (candidate) =>
        candidate.method === 'DELETE' &&
        candidate.url.includes('/api/v1/admin/whatsapp/connection'),
    );
    deleted.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Desconectado');
    http.verify();
  });

  it('lists the status switches and shows a masked send error', async () => {
    const fixture = create();
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushConnection(http, {
      phoneNumber: '+5511988887777',
      businessAccountId: '102290129340398',
      phoneNumberId: '106540352242922',
      status: 'CONNECTED',
      credentialsHint: 'alue',
    });
    flushTemplates(http, [
      {
        key: 'order_accepted',
        enabled: true,
        persisted: true,
        lastError: {
          maskedPhone: '*******1234',
          message: 'TEMPLATE_NOT_APPROVED',
        },
      },
    ]);
    flushSends(http, []);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Pedido aceito');
    expect(fixture.nativeElement.textContent).toContain('*******1234');
    expect(fixture.nativeElement.textContent).toContain(
      'O template ainda não foi aprovado na Meta.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('5511999991234');

    const checkbox = fixture.nativeElement.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const patched = http.expectOne(
      (candidate) =>
        candidate.method === 'PATCH' &&
        candidate.url.includes('/api/v1/admin/whatsapp/templates/order_accepted'),
    );
    expect(patched.request.body).toEqual({ enabled: false });
    patched.flush({
      key: 'order_accepted',
      enabled: false,
      persisted: true,
      lastError: null,
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(checkbox.checked).toBe(false);
    http.verify();
  });

  it('lists the last system sends with template, status, time and a short error', async () => {
    const fixture = create();
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushConnection(http, { error: { code: 'WHATSAPP_CONNECTION_NOT_FOUND' } }, 404);
    flushTemplates(http, []);
    flushSends(http, [
      {
        id: '11111111-1111-4111-8111-111111111111',
        templateKey: 'order_received',
        status: 'FAILED',
        createdAt: '2026-10-05T15:04:00.000Z',
        error: 'TEMPLATE_NOT_APPROVED',
        body: 'https://loja.localhost/pedido/secret-token',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Envios');
    expect(text).toContain('Pedido recebido');
    expect(text).toContain('Falhou');
    expect(text).toContain('O template ainda não foi aprovado na Meta.');
    const time = fixture.nativeElement.querySelector('time') as HTMLTimeElement;
    expect(time.dateTime).toBe('2026-10-05T15:04:00.000Z');
    expect(text).not.toContain('secret-token');
    expect(text).not.toContain('/pedido/');
    http.verify();
  });
});

function flushConnection(
  http: HttpTestingController,
  body: object,
  status = 200,
): void {
  http
    .expectOne(
      (candidate) =>
        candidate.method === 'GET' &&
        candidate.url.includes('/api/v1/admin/whatsapp/connection'),
    )
    .flush(body, { status, statusText: status === 200 ? 'OK' : 'Not Found' });
}

function flushSends(http: HttpTestingController, data: unknown[]): void {
  http
    .expectOne(
      (candidate) =>
        candidate.method === 'GET' &&
        candidate.url.includes('/api/v1/admin/whatsapp/sends'),
    )
    .flush({ data });
}

function flushTemplates(http: HttpTestingController, data: unknown[]): void {
  http
    .expectOne(
      (candidate) =>
        candidate.method === 'GET' &&
        candidate.url.includes('/api/v1/admin/whatsapp/templates'),
    )
    .flush({ data });
}

function create() {
  TestBed.configureTestingModule({
    imports: [WhatsAppSettingsSection],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  return TestBed.createComponent(WhatsAppSettingsSection);
}

function fill(
  fixture: ReturnType<typeof create>,
  label: string,
  value: string,
): void {
  const field = [...fixture.nativeElement.querySelectorAll('label')].find(
    (item: HTMLLabelElement) => item.textContent?.includes(label),
  ) as HTMLLabelElement | undefined;
  const input = field?.querySelector('input');
  if (input === null || input === undefined) {
    throw new Error(`missing ${label}`);
  }
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function click(fixture: ReturnType<typeof create>, label: string): void {
  const button = [...fixture.nativeElement.querySelectorAll('button')].find(
    (item: HTMLButtonElement) => item.textContent?.includes(label),
  ) as HTMLButtonElement | undefined;
  if (button === undefined) {
    throw new Error(`missing ${label}`);
  }
  button.click();
  fixture.detectChanges();
}
