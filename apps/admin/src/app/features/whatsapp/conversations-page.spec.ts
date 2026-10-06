import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import {
  CONVERSATION_FEED,
  ConversationNotice,
} from './conversation-feed';
import { ConversationsPage } from './conversations-page';

const conversationId = '44444444-4444-4444-8444-444444444444';
const fullPhone = '5511999991234';

describe('ConversationsPage', () => {
  it('shows an empty state', async () => {
    const fixture = create();
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushList(http, []);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nenhuma conversa');
    http.verify();
  });

  it('masks the phone on the card and shows the full number only in the thread', async () => {
    const fixture = create();
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushList(http, [
      {
        id: conversationId,
        maskedPhone: '*********1234',
        contactName: 'Ana',
        mode: 'HUMAN',
        lastMessageAt: '2026-10-05T12:00:00.000Z',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('*********1234');
    expect(fixture.nativeElement.textContent).not.toContain(fullPhone);

    click(fixture, 'Ana');
    flushThread(http);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(fullPhone);
    expect(fixture.nativeElement.textContent).toContain('oi');
    http.verify();
  });

  it('sends a reply and appends a live message without another load', async () => {
    const notices = new Subject<ConversationNotice>();
    const fixture = create(notices);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushList(http, [
      {
        id: conversationId,
        maskedPhone: '*********1234',
        contactName: null,
        mode: 'HUMAN',
        lastMessageAt: '2026-10-05T12:00:00.000Z',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    click(fixture, '*********1234');
    flushThread(http);
    await fixture.whenStable();
    fixture.detectChanges();

    const area = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    area.value = 'pode retirar';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    click(fixture, 'Enviar');
    const posted = http.expectOne(
      (candidate) =>
        candidate.method === 'POST' &&
        candidate.url.includes(`/conversations/${conversationId}/messages`),
    );
    expect(posted.request.body).toEqual({ body: 'pode retirar' });
    posted.flush({
      id: '55555555-5555-4555-8555-555555555555',
      direction: 'OUT',
      author: 'USER',
      body: 'pode retirar',
      templateKey: null,
      status: 'QUEUED',
      createdAt: '2026-10-05T12:01:00.000Z',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('pode retirar');

    notices.next({
      conversationId,
      messageId: '66666666-6666-4666-8666-666666666666',
      body: 'obrigado',
      author: 'CUSTOMER',
      direction: 'IN',
      createdAt: '2026-10-05T12:02:00.000Z',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('obrigado');
    http.verify();
  });

  it('asks before closing the conversation', async () => {
    const fixture = create();
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushList(http, [
      {
        id: conversationId,
        maskedPhone: '*********1234',
        contactName: 'Ana',
        mode: 'HUMAN',
        lastMessageAt: '2026-10-05T12:00:00.000Z',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    click(fixture, 'Ana');
    flushThread(http);
    await fixture.whenStable();
    fixture.detectChanges();

    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    click(fixture, 'Encerrar');
    expect(confirm).toHaveBeenCalled();
    http.expectNone((candidate) => candidate.url.includes('/close'));

    confirm.mockReturnValue(true);
    click(fixture, 'Encerrar');
    const closed = http.expectOne((candidate) => candidate.url.includes('/close'));
    closed.flush({
      id: conversationId,
      maskedPhone: '*********1234',
      contactName: 'Ana',
      mode: 'CLOSED',
      linkedOrderId: null,
      lastMessageAt: '2026-10-05T12:00:00.000Z',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Conversa encerrada.');
    http.verify();
  });

  it('shows the mode and passes a conversation to the bot', async () => {
    const fixture = create();
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushList(http, [
      {
        id: conversationId,
        maskedPhone: '*********1234',
        contactName: 'Ana',
        mode: 'HUMAN',
        lastMessageAt: '2026-10-05T12:00:00.000Z',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    click(fixture, 'Ana');
    flushThread(http);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Modo: Humano');
    click(fixture, 'Passar para o bot');
    const changed = http.expectOne(
      (candidate) =>
        candidate.method === 'POST' &&
        candidate.url.includes(`/conversations/${conversationId}/mode`),
    );
    expect(changed.request.body).toEqual({ mode: 'BOT' });
    changed.flush({
      id: conversationId,
      contactPhone: fullPhone,
      contactName: 'Ana',
      mode: 'BOT',
      linkedOrderId: null,
      lastMessageAt: '2026-10-05T12:00:00.000Z',
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Modo: Bot');
    http.verify();
  });

  it('links a conversation to its order detail and lets the store assume it', async () => {
    const fixture = create();
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    flushList(http, [
      {
        id: conversationId,
        maskedPhone: '*********1234',
        contactName: 'Ana',
        mode: 'BOT',
        linkedOrderId: '88888888-8888-4888-8888-888888888888',
        lastMessageAt: '2026-10-05T12:00:00.000Z',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    click(fixture, 'Ana');
    flushThread(http, '88888888-8888-4888-8888-888888888888', 'BOT');
    await fixture.whenStable();
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      'a[href="/pedidos#order-88888888-8888-4888-8888-888888888888"]',
    );
    expect(link).not.toBeNull();
    click(fixture, 'Assumir atendimento');
    const changed = http.expectOne(
      (candidate) =>
        candidate.method === 'POST' &&
        candidate.url.includes(`/conversations/${conversationId}/mode`),
    );
    expect(changed.request.body).toEqual({ mode: 'HUMAN' });
    changed.flush({
      id: conversationId,
      contactPhone: fullPhone,
      contactName: 'Ana',
      mode: 'HUMAN',
      linkedOrderId: '88888888-8888-4888-8888-888888888888',
      lastMessageAt: '2026-10-05T12:00:00.000Z',
    });
    http.verify();
  });
});

function create(notices = new Subject<ConversationNotice>()) {
  TestBed.configureTestingModule({
    imports: [ConversationsPage],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: CONVERSATION_FEED,
        useValue: { watch: () => notices.asObservable() },
      },
    ],
  });
  return TestBed.createComponent(ConversationsPage);
}

function flushList(http: HttpTestingController, data: unknown[]): void {
  http
    .expectOne(
      (candidate) =>
        candidate.method === 'GET' &&
        candidate.url.includes('/api/v1/admin/whatsapp/conversations') &&
        !candidate.url.includes('/messages'),
    )
    .flush({ data, meta: { page: 1, pageSize: 50, total: data.length, totalPages: 1 } });
}

function flushThread(
  http: HttpTestingController,
  linkedOrderId: string | null = null,
  mode = 'HUMAN',
): void {
  http
    .expectOne(
      (candidate) =>
        candidate.method === 'GET' && candidate.url.includes('/messages'),
    )
    .flush({
      conversation: {
        id: conversationId,
        contactPhone: fullPhone,
        contactName: 'Ana',
        mode,
        linkedOrderId,
        lastMessageAt: '2026-10-05T12:00:00.000Z',
      },
      data: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          direction: 'IN',
          author: 'CUSTOMER',
          body: 'oi',
          templateKey: null,
          status: 'SENT',
          createdAt: '2026-10-05T12:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });
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
