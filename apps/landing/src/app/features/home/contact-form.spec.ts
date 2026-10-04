import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactForm } from './contact-form';

describe('ContactForm', () => {
  let fixture: ComponentFixture<ContactForm>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(ContactForm);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('does not send an empty form', () => {
    const button = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    http.expectNone('http://localhost:3000/api/v1/public/leads');
  });

  it('posts a valid lead', () => {
    fixture.componentInstance.form.setValue({
      name: 'Ana Souza',
      email: 'ana@padaria.example',
      phone: '11999999999',
      establishmentName: 'Padaria da Ana',
    });
    fixture.componentInstance.submit();

    const request = http.expectOne('http://localhost:3000/api/v1/public/leads');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Ana Souza',
      email: 'ana@padaria.example',
      phone: '11999999999',
      establishmentName: 'Padaria da Ana',
    });
    request.flush({ id: '6d1b7d3a-1c0e-4b7a-9c1a-0a0a0a0a0a0a' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Recebemos seu interesse',
    );
  });
});
