import { provideHttpClient } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SessionService } from '../../core/session.service';
import { CustomersPage } from './customers-page';

describe('CustomersPage', () => {
  it('asks for a phone before searching', () => {
    const fixture = create();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Busque pelo telefone',
    );
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows the customer and an empty address list', async () => {
    const fixture = create();
    fixture.detectChanges();
    fixture.componentInstance.form.controls.phone.setValue('(11) 98888-7777');
    fixture.debugElement
      .query(By.css('form'))
      .triggerEventHandler('ngSubmit', {});
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    const list = http.expectOne((candidate) =>
      candidate.url.includes('/api/v1/admin/customers'),
    );
    expect(list.request.params.get('phone')).toBe('(11) 98888-7777');
    list.flush({
      data: [{ id: 'customer-1', name: 'Ana', phone: '5511988887777' }],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const detail = http.expectOne((candidate) =>
      candidate.url.includes('/api/v1/admin/customers/customer-1'),
    );
    detail.flush({
      id: 'customer-1',
      name: 'Ana',
      phone: '5511988887777',
      addresses: [],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ana');
    expect(fixture.nativeElement.textContent).toContain(
      'Nenhum endereço cadastrado.',
    );
    http.verify();
  });

  it('shows an invalid phone message', async () => {
    const fixture = create();
    fixture.detectChanges();
    fixture.componentInstance.form.controls.phone.setValue('123');
    fixture.debugElement
      .query(By.css('form'))
      .triggerEventHandler('ngSubmit', {});
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    const list = http.expectOne((candidate) =>
      candidate.url.includes('/api/v1/admin/customers'),
    );
    list.flush(
      { error: { code: 'INVALID_PHONE' } },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Informe um telefone válido com DDD.',
    );
    http.verify();
  });

  it('asks for the phone before anonymizing and keeps the order history message', async () => {
    const fixture = create();
    TestBed.inject(SessionService).currentUser.set({
      id: 'owner-1',
      name: 'Olga',
      email: 'olga@example.com',
      role: 'OWNER',
      permissions: ['users.manage', 'customers.read'],
    });
    fixture.detectChanges();
    fixture.componentInstance.form.controls.phone.setValue('11988887777');
    fixture.debugElement
      .query(By.css('form'))
      .triggerEventHandler('ngSubmit', {});
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((candidate) => candidate.url.includes('/api/v1/admin/customers'))
      .flush({
        data: [{ id: 'customer-1', name: 'Ana', phone: '5511988887777' }],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      });
    await fixture.whenStable();
    fixture.detectChanges();
    http.expectOne((candidate) => candidate.url.endsWith('/customer-1')).flush({
      id: 'customer-1',
      name: 'Ana',
      phone: '5511988887777',
      addresses: [
        {
          id: 'address-1',
          label: null,
          line: 'Rua A',
          number: '10',
          complement: null,
          district: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          postalCode: '01001000',
        },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Digite o telefone do cliente para confirmar',
    );
    const confirm = fixture.debugElement.queryAll(By.css('form'))[1];
    expect(confirm).toBeTruthy();
    fixture.componentInstance.anonymizeForm.controls.phone.setValue('11988887777');
    confirm?.triggerEventHandler('ngSubmit', {});
    fixture.detectChanges();

    const anonymize = http.expectOne(
      (candidate) =>
        candidate.method === 'POST' && candidate.url.endsWith('/anonymize'),
    );
    expect(anonymize.request.body).toEqual({ phone: '11988887777' });
    anonymize.flush({
      id: 'customer-1',
      name: 'Cliente anonimizado',
      phone: 'a'.repeat(64),
      addresses: [
        {
          id: 'address-1',
          label: null,
          line: '',
          number: '',
          complement: null,
          district: '',
          city: 'São Paulo',
          state: 'SP',
          postalCode: '',
        },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'O histórico de pedidos foi mantido',
    );
    expect(fixture.nativeElement.textContent).toContain('telefone oculto');
    expect(fixture.nativeElement.textContent).toContain('São Paulo/SP');
    http.verify();
  });
});

function create() {
  TestBed.configureTestingModule({
    imports: [CustomersPage],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  return TestBed.createComponent(CustomersPage);
}
