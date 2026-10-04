import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PublicStore, PublicStoreClient } from './public-store.client';

function store(primary: string): PublicStore {
  return {
    name: primary,
    phone: '11999999999',
    address: {
      line: 'Rua',
      number: '1',
      district: 'Centro',
      city: 'Sao Paulo',
      state: 'SP',
      postalCode: '01000-000',
    },
    branding: {
      displayName: primary,
      logoUrl: null,
      faviconUrl: null,
      bannerUrl: null,
      primaryColor: primary,
      secondaryColor: '#FFFFFF',
      accentColor: '#111111',
      seoTitle: primary,
      seoDescription: '',
    },
    slug: 'loja',
    minimumOrderCents: 0,
    isOpen: true,
  };
}

describe('PublicStoreClient', () => {
  let client: PublicStoreClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PublicStoreClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads different colors for host A and host B', () => {
    const colors: string[] = [];
    client.load('pizzariadoze.localhost').subscribe((loaded) => {
      colors.push(loaded.branding.primaryColor);
    });
    const pizza = http.expectOne(
      (call) => call.headers.get('X-Tenant-Host') === 'pizzariadoze.localhost',
    );
    pizza.flush(store('#C0392B'));

    client.load('burgercentral.localhost').subscribe((loaded) => {
      colors.push(loaded.branding.primaryColor);
    });
    const burger = http.expectOne(
      (call) => call.headers.get('X-Tenant-Host') === 'burgercentral.localhost',
    );
    burger.flush(store('#E67E22'));

    expect(colors).toEqual(['#C0392B', '#E67E22']);
  });
});
