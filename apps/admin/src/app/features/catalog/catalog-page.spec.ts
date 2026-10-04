import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogPage } from './catalog-page';

describe('CatalogPage', () => {
  it('shows an empty menu after loading', async () => {
    TestBed.configureTestingModule({
      imports: [CatalogPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const fixture = TestBed.createComponent(CatalogPage);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne((candidate) =>
      candidate.url.includes('/api/v1/admin/categories'),
    );
    request.flush({
      data: [],
      meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nenhuma categoria');
    http.verify();
  });

  it('shows the load error', async () => {
    TestBed.configureTestingModule({
      imports: [CatalogPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const fixture = TestBed.createComponent(CatalogPage);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne((candidate) =>
      candidate.url.includes('/api/v1/admin/categories'),
    );
    request.flush(
      { error: { code: 'FORBIDDEN' } },
      { status: 403, statusText: 'Forbidden' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Você não tem permissão para alterar o cardápio.',
    );
    http.verify();
  });
});
