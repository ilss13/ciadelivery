import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { clearBrandTheme } from '../../core/brand-theme';
import { PublicStore } from '../../core/public-store.client';
import { StorePage } from './store-page';

function store(
  primary: string,
  secondary: string,
  accent: string,
): PublicStore {
  return {
    name: 'Pizzaria do Ze',
    phone: '11911110000',
    address: {
      line: 'Rua da Pizza',
      number: '12',
      district: 'Centro',
      city: 'Sao Paulo',
      state: 'SP',
      postalCode: '01001-000',
    },
    branding: {
      displayName: 'Pizzaria do Ze',
      logoUrl: null,
      faviconUrl: null,
      bannerUrl: null,
      primaryColor: primary,
      secondaryColor: secondary,
      accentColor: accent,
      seoTitle: 'Pizzaria do Ze',
      seoDescription: 'Pizza no capricho',
    },
    isOpen: true,
  };
}

describe('StorePage', () => {
  let fixture: ComponentFixture<StorePage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StorePage],
      providers: [provideHttpClient(), provideHttpClientTesting(), Title, Meta],
    }).compileComponents();
    fixture = TestBed.createComponent(StorePage);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    clearBrandTheme(document.documentElement);
    http.verify();
  });

  it('applies the branding colors on the document root', () => {
    fixture.detectChanges();
    const request = http.expectOne(
      (call) => call.url === 'http://localhost:3000/api/v1/public/store',
    );
    request.flush(store('#C0392B', '#FFFFFF', '#111111'));
    fixture.detectChanges();

    expect(
      document.documentElement.style.getPropertyValue('--brand-primary'),
    ).toBe('#C0392B');
    expect(
      document.documentElement.style.getPropertyValue('--brand-secondary'),
    ).toBe('#FFFFFF');
    expect(
      document.documentElement.style.getPropertyValue('--brand-accent'),
    ).toBe('#111111');
    expect(fixture.nativeElement.textContent).toContain('Pizzaria do Ze');
  });

  it('clears the previous colors when the host is unknown', () => {
    document.documentElement.style.setProperty('--brand-primary', '#E67E22');
    fixture.detectChanges();
    const request = http.expectOne(
      (call) => call.url === 'http://localhost:3000/api/v1/public/store',
    );
    request.flush(
      {
        error: {
          code: 'TENANT_NOT_FOUND',
          message: 'missing',
          details: null,
          requestId: '1',
        },
      },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();

    expect(
      document.documentElement.style.getPropertyValue('--brand-primary'),
    ).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Loja não encontrada');
    expect(fixture.nativeElement.textContent).not.toContain('Pizzaria');
  });
});
