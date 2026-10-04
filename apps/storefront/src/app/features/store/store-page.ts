import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { readErrorCode } from '../../core/api-error';
import { applyBrandTheme, clearBrandTheme } from '../../core/brand-theme';
import {
  PublicStore,
  PublicStoreClient,
  StoreAddress,
} from '../../core/public-store.client';

type StoreStatus = 'loading' | 'ready' | 'missing' | 'suspended' | 'error';

@Component({
  selector: 'storefront-store-page',
  templateUrl: './store-page.html',
})
export class StorePage implements OnInit {
  private readonly client = inject(PublicStoreClient);
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<StoreStatus>('loading');
  readonly store = signal<PublicStore | null>(null);
  readonly errorCode = signal('');

  ngOnInit(): void {
    this.load(this.document.location.host);
  }

  load(host: string): void {
    clearBrandTheme(this.document.documentElement);
    this.store.set(null);
    this.status.set('loading');
    this.client
      .load(host)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (store) => this.showStore(store),
        error: (error: unknown) => this.showFailure(error),
      });
  }

  formatAddress(address: StoreAddress): string {
    return `${address.line}, ${address.number} — ${address.district}, ${address.city}/${address.state} — ${address.postalCode}`;
  }

  private showStore(store: PublicStore): void {
    applyBrandTheme(this.document.documentElement, store.branding);
    const title =
      store.branding.seoTitle.trim().length > 0
        ? store.branding.seoTitle
        : store.branding.displayName;
    this.title.setTitle(title);
    this.meta.updateTag({
      name: 'description',
      content: store.branding.seoDescription,
    });
    this.setFavicon(store.branding.faviconUrl);
    this.store.set(store);
    this.status.set('ready');
  }

  private showFailure(error: unknown): void {
    clearBrandTheme(this.document.documentElement);
    this.store.set(null);
    this.setFavicon(null);
    this.meta.updateTag({ name: 'description', content: '' });
    const code = readErrorCode(error);
    this.errorCode.set(code);
    if (code === 'TENANT_SUSPENDED') {
      this.title.setTitle('Loja indisponível');
      this.status.set('suspended');
      return;
    }
    if (code === 'TENANT_NOT_FOUND') {
      this.title.setTitle('Loja não encontrada');
      this.status.set('missing');
      return;
    }
    this.title.setTitle('Loja indisponível');
    this.status.set('error');
  }

  private setFavicon(url: string | null): void {
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link === null) {
      link = this.document.createElement('link');
      link.rel = 'icon';
      this.document.head.appendChild(link);
    }
    link.href = url === null || url.length === 0 ? 'favicon.ico' : url;
  }
}
