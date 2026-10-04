import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, forkJoin, reduce } from 'rxjs';
import { apiUrl } from '../../core/api-url';

export interface MenuOption {
  id: string;
  name: string;
  priceCents: number;
  available: boolean;
}

export interface MenuGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: MenuOption[];
}

export interface MenuProduct {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  available: boolean;
  optionGroups: MenuGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
}

interface Page<T> {
  data: T[];
  meta: { page: number; totalPages: number };
}

export interface PublicMenu {
  categories: MenuCategory[];
  products: MenuProduct[];
}

@Injectable({ providedIn: 'root' })
export class PublicCatalogClient {
  private readonly http = inject(HttpClient);

  load(host: string): Observable<PublicMenu> {
    return forkJoin({
      categories: this.pages<MenuCategory>(host, '/api/v1/public/categories'),
      products: this.pages<MenuProduct>(host, '/api/v1/public/products'),
    });
  }

  private pages<T>(host: string, path: string): Observable<T[]> {
    const page = (pageNumber: number): Observable<Page<T>> =>
      this.http.get<Page<T>>(apiUrl(path), {
        headers: { 'X-Tenant-Host': host },
        params: new HttpParams().set('page', pageNumber).set('pageSize', 100),
      });
    return page(1).pipe(
      expand((result) =>
        result.meta.page < result.meta.totalPages
          ? page(result.meta.page + 1)
          : EMPTY,
      ),
      reduce((all, result) => all.concat(result.data), [] as T[]),
    );
  }
}
