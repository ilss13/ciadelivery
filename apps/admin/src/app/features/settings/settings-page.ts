import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { CanDeactivateFn } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';
import { readErrorCode } from '../../core/api-error';
import { apiUrl } from '../../core/api-url';
import {
  imageFileMessage,
  imageUploadError,
  mediaUrl,
} from '../../shared/image-file';
import { centsToReais, reaisToCents } from './money';

const WEEKDAYS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

interface StoreSettings {
  name: string;
  phone: string;
  address: {
    line: string;
    number: string;
    district: string;
    city: string;
    state: string;
    postalCode: string;
  };
  minimumOrderCents: number;
  isManuallyClosed: boolean;
}

interface BrandingSettings {
  displayName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string | null;
  seoTitle: string;
  seoDescription: string;
  instagramUrl: string | null;
  facebookUrl: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
  whatsappPhone: string | null;
}

interface BusinessHour {
  weekday: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
}

@Component({
  selector: 'admin-settings-page',
  imports: [ReactiveFormsModule],
  templateUrl: './settings-page.html',
})
export class SettingsPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly formBuilder = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly weekdays = WEEKDAYS;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly notice = signal('');
  readonly noticeIsError = signal(false);
  readonly logoUrl = signal<string | null>(null);
  readonly faviconUrl = signal<string | null>(null);
  readonly bannerUrl = signal<string | null>(null);
  readonly imageError = signal('');
  readonly uploadingImage = signal(false);

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    phone: ['', Validators.required],
    line: ['', Validators.required],
    number: ['', Validators.required],
    district: ['', Validators.required],
    city: ['', Validators.required],
    state: ['', Validators.required],
    postalCode: ['', Validators.required],
    minimumOrder: ['0,00', [Validators.required, minimumOrder]],
    isManuallyClosed: false,
    displayName: ['', Validators.required],
    primaryColor: ['#111111', colorValidator],
    secondaryColor: ['#FFFFFF', colorValidator],
    accentColor: ['#111111', colorValidator],
    fontFamily: '',
    seoTitle: ['', Validators.required],
    seoDescription: '',
    instagramUrl: '',
    facebookUrl: '',
    websiteUrl: '',
    contactEmail: ['', optionalEmail],
    whatsappPhone: '',
    customDomain: '',
    hours: this.formBuilder.array(
      WEEKDAYS.map((_, weekday) =>
        this.formBuilder.nonNullable.group({
          weekday,
          opensAt: '18:00',
          closesAt: '23:00',
          closed: false,
        }),
      ),
    ),
  });

  ngOnInit(): void {
    forkJoin({
      store: this.http.get<StoreSettings>(apiUrl('/api/v1/admin/store')),
      branding: this.http.get<BrandingSettings>(
        apiUrl('/api/v1/admin/branding'),
      ),
      hours: this.http.get<{ hours: BusinessHour[] }>(
        apiUrl('/api/v1/admin/store/hours'),
      ),
      domain: this.http.get<{ customDomain: string | null }>(
        apiUrl('/api/v1/admin/domain'),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (loaded) => {
          this.applyLoaded(loaded);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.noticeIsError.set(true);
          this.notice.set(readErrorCode(error));
          this.loading.set(false);
        },
      });
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty;
  }

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      this.noticeIsError.set(true);
      this.notice.set('Revise os campos antes de salvar.');
      return;
    }

    const cents = reaisToCents(this.form.controls.minimumOrder.value);
    if (cents === null) {
      this.noticeIsError.set(true);
      this.notice.set('Revise os campos antes de salvar.');
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.notice.set('');
    this.http
      .put(apiUrl('/api/v1/admin/store'), {
        name: value.name.trim(),
        phone: value.phone.trim(),
        address: {
          line: value.line.trim(),
          number: value.number.trim(),
          district: value.district.trim(),
          city: value.city.trim(),
          state: value.state.trim(),
          postalCode: value.postalCode.trim(),
        },
        minimumOrderCents: cents,
        isManuallyClosed: value.isManuallyClosed,
      })
      .pipe(
        switchMap(() =>
          this.http.put(apiUrl('/api/v1/admin/branding'), {
            displayName: value.displayName.trim(),
            logoUrl: this.logoUrl(),
            faviconUrl: this.faviconUrl(),
            bannerUrl: this.bannerUrl(),
            primaryColor: value.primaryColor.trim().toUpperCase(),
            secondaryColor: value.secondaryColor.trim().toUpperCase(),
            accentColor: value.accentColor.trim().toUpperCase(),
            fontFamily: emptyToNull(value.fontFamily),
            seoTitle: value.seoTitle.trim(),
            seoDescription: value.seoDescription.trim(),
            instagramUrl: emptyToNull(value.instagramUrl),
            facebookUrl: emptyToNull(value.facebookUrl),
            websiteUrl: emptyToNull(value.websiteUrl),
            contactEmail: emptyToNull(value.contactEmail),
            whatsappPhone: emptyToNull(value.whatsappPhone),
          }),
        ),
        switchMap(() =>
          this.http.put(apiUrl('/api/v1/admin/store/hours'), {
            hours: value.hours.map((day) => ({
              weekday: day.weekday,
              opensAt: withSeconds(day.opensAt),
              closesAt: withSeconds(day.closesAt),
              closed: day.closed,
            })),
          }),
        ),
        switchMap(() =>
          this.http.put(apiUrl('/api/v1/admin/domain'), {
            customDomain: emptyToNull(value.customDomain),
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.form.markAsPristine();
          this.saving.set(false);
          this.noticeIsError.set(false);
          this.notice.set('Configuração salva.');
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.noticeIsError.set(true);
          this.notice.set(readErrorCode(error));
        },
      });
  }

  preview(url: string | null): string | null {
    return mediaUrl(url);
  }

  onLogoSelected(event: Event): void {
    this.uploadAsset('logo', event);
  }

  onFaviconSelected(event: Event): void {
    this.uploadAsset('favicon', event);
  }

  onBannerSelected(event: Event): void {
    this.uploadAsset('banner', event);
  }

  private uploadAsset(
    kind: 'logo' | 'favicon' | 'banner',
    event: Event,
  ): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) {
      return;
    }
    const message = imageFileMessage(file);
    if (message !== null) {
      this.imageError.set(message);
      return;
    }
    this.imageError.set('');
    this.uploadingImage.set(true);
    const body = new FormData();
    body.append('file', file);
    this.http
      .post<{ url: string }>(apiUrl(`/api/v1/admin/branding/${kind}`), body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stored) => {
          this.uploadingImage.set(false);
          if (kind === 'logo') {
            this.logoUrl.set(stored.url);
          } else if (kind === 'favicon') {
            this.faviconUrl.set(stored.url);
          } else {
            this.bannerUrl.set(stored.url);
          }
          this.noticeIsError.set(false);
          this.notice.set('Imagem enviada.');
        },
        error: (error: unknown) => {
          this.uploadingImage.set(false);
          this.imageError.set(imageUploadError(error));
        },
      });
  }

  private applyLoaded(loaded: {
    store: StoreSettings;
    branding: BrandingSettings;
    hours: { hours: BusinessHour[] };
    domain: { customDomain: string | null };
  }): void {
    const byWeekday = new Map(
      loaded.hours.hours.map((day) => [day.weekday, day]),
    );
    this.form.patchValue({
      name: loaded.store.name,
      phone: loaded.store.phone,
      line: loaded.store.address.line,
      number: loaded.store.address.number,
      district: loaded.store.address.district,
      city: loaded.store.address.city,
      state: loaded.store.address.state,
      postalCode: loaded.store.address.postalCode,
      minimumOrder: centsToReais(loaded.store.minimumOrderCents),
      isManuallyClosed: loaded.store.isManuallyClosed,
      displayName: loaded.branding.displayName,
      primaryColor: loaded.branding.primaryColor,
      secondaryColor: loaded.branding.secondaryColor,
      accentColor: loaded.branding.accentColor,
      fontFamily: loaded.branding.fontFamily ?? '',
      seoTitle: loaded.branding.seoTitle,
      seoDescription: loaded.branding.seoDescription,
      instagramUrl: loaded.branding.instagramUrl ?? '',
      facebookUrl: loaded.branding.facebookUrl ?? '',
      websiteUrl: loaded.branding.websiteUrl ?? '',
      contactEmail: loaded.branding.contactEmail ?? '',
      whatsappPhone: loaded.branding.whatsappPhone ?? '',
      customDomain: loaded.domain.customDomain ?? '',
    });
    this.logoUrl.set(loaded.branding.logoUrl);
    this.faviconUrl.set(loaded.branding.faviconUrl);
    this.bannerUrl.set(loaded.branding.bannerUrl);
    for (const group of this.form.controls.hours.controls) {
      const day = byWeekday.get(group.controls.weekday.value);
      if (day === undefined) {
        continue;
      }
      group.patchValue({
        opensAt: day.opensAt.slice(0, 5),
        closesAt: day.closesAt.slice(0, 5),
        closed: day.closed,
      });
    }
    this.form.markAsPristine();
  }
}

export const discardSettingsGuard: CanDeactivateFn<SettingsPage> = (
  component,
) => {
  if (!component.hasUnsavedChanges()) {
    return true;
  }

  return window.confirm('Há alterações não salvas. Deseja sair sem salvar?');
};

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function withSeconds(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

function optionalEmail(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (value.length === 0) {
    return null;
  }

  return Validators.email(control);
}

function colorValidator(control: AbstractControl): ValidationErrors | null {
  return /^#[0-9A-Fa-f]{6}$/.test(String(control.value ?? '').trim())
    ? null
    : { color: true };
}

function minimumOrder(control: AbstractControl): ValidationErrors | null {
  return reaisToCents(String(control.value ?? '')) === null
    ? { minimumOrder: true }
    : null;
}
