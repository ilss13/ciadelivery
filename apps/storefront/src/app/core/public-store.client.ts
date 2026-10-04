import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from './api-url';

export interface StoreAddress {
  line: string;
  number: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface StoreBranding {
  displayName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  seoTitle: string;
  seoDescription: string;
}

export interface PublicStore {
  name: string;
  phone: string;
  address: StoreAddress;
  branding: StoreBranding;
  isOpen: boolean;
}

@Injectable({ providedIn: 'root' })
export class PublicStoreClient {
  private readonly http = inject(HttpClient);

  load(host: string): Observable<PublicStore> {
    return this.http.get<PublicStore>(apiUrl('/api/v1/public/store'), {
      headers: { 'X-Tenant-Host': host },
    });
  }
}
