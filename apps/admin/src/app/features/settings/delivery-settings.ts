import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { apiUrl } from '../../core/api-url';
import { deliveryErrorMessage } from './delivery-messages';
import { centsToReais, reaisToCents } from './money';

interface DeliveryConfig {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  maxRadiusKm: number;
  feeMode: 'FLAT' | 'ZONE';
  flatFeeCents: number;
  estimatedMinutes: number;
}

interface DeliveryZone {
  id: string;
  fromKm: number;
  toKm: number;
  feeCents: number;
  sortOrder: number;
}

interface ZoneDraft {
  key: string;
  fromKm: string;
  toKm: string;
  fee: string;
}

@Component({
  selector: 'admin-delivery-settings',
  templateUrl: './delivery-settings.html',
})
export class DeliverySettingsSection implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private nextKey = 1;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly deliveryEnabled = signal(true);
  readonly pickupEnabled = signal(true);
  readonly maxRadiusKm = signal('8');
  readonly feeMode = signal<'FLAT' | 'ZONE'>('FLAT');
  readonly flatFee = signal('0,00');
  readonly estimatedMinutes = signal('40');
  readonly zones = signal<ZoneDraft[]>([]);
  private readonly dirty = signal(false);

  ngOnInit(): void {
    forkJoin({
      config: this.http.get<DeliveryConfig>(
        apiUrl('/api/v1/admin/delivery/config'),
      ),
      zones: this.http.get<{ zones: DeliveryZone[] }>(
        apiUrl('/api/v1/admin/delivery/zones'),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (loaded) => {
          this.apply(loaded.config, loaded.zones.zones);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(deliveryErrorMessage(error));
        },
      });
  }

  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  setDeliveryEnabled(event: Event): void {
    this.deliveryEnabled.set(checked(event));
    this.touch();
  }

  setPickupEnabled(event: Event): void {
    this.pickupEnabled.set(checked(event));
    this.touch();
  }

  setRadius(event: Event): void {
    this.maxRadiusKm.set(text(event));
    this.touch();
  }

  setFeeMode(event: Event): void {
    const value = text(event);
    this.feeMode.set(value === 'ZONE' ? 'ZONE' : 'FLAT');
    this.touch();
  }

  setFlatFee(event: Event): void {
    this.flatFee.set(text(event));
    this.touch();
  }

  setMinutes(event: Event): void {
    this.estimatedMinutes.set(text(event));
    this.touch();
  }

  setZone(key: string, field: 'fromKm' | 'toKm' | 'fee', event: Event): void {
    const value = text(event);
    this.zones.update((zones) =>
      zones.map((zone) =>
        zone.key === key ? { ...zone, [field]: value } : zone,
      ),
    );
    this.touch();
  }

  addZone(): void {
    const zones = this.zones();
    const previous = zones[zones.length - 1];
    const fromKm = previous?.toKm ?? '0';
    this.zones.update((zones) => [
      ...zones,
      { key: this.key(), fromKm, toKm: '', fee: '0,00' },
    ]);
    this.touch();
  }

  removeZone(key: string): void {
    if (!window.confirm('Remover esta faixa de entrega?')) {
      return;
    }
    this.zones.update((zones) => zones.filter((zone) => zone.key !== key));
    this.touch();
  }

  save(): void {
    const payload = this.payload();
    if (payload === null) {
      this.error.set('Revise raio, tempo e faixas antes de salvar.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    this.http
      .put<DeliveryConfig>(apiUrl('/api/v1/admin/delivery/config'), payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config) => {
          this.deliveryEnabled.set(config.deliveryEnabled);
          this.pickupEnabled.set(config.pickupEnabled);
          this.maxRadiusKm.set(formatKm(config.maxRadiusKm));
          this.feeMode.set(config.feeMode);
          this.flatFee.set(centsToReais(config.flatFeeCents));
          this.estimatedMinutes.set(String(config.estimatedMinutes));
          this.dirty.set(false);
          this.saving.set(false);
          this.notice.set('Entrega salva.');
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(deliveryErrorMessage(error));
        },
      });
  }

  private apply(config: DeliveryConfig, zones: DeliveryZone[]): void {
    this.deliveryEnabled.set(config.deliveryEnabled);
    this.pickupEnabled.set(config.pickupEnabled);
    this.maxRadiusKm.set(formatKm(config.maxRadiusKm));
    this.feeMode.set(config.feeMode);
    this.flatFee.set(centsToReais(config.flatFeeCents));
    this.estimatedMinutes.set(String(config.estimatedMinutes));
    this.zones.set(
      [...zones]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((zone) => ({
          key: this.key(),
          fromKm: formatKm(zone.fromKm),
          toKm: formatKm(zone.toKm),
          fee: centsToReais(zone.feeCents),
        })),
    );
    this.dirty.set(false);
  }

  private payload(): {
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    maxRadiusKm: number;
    feeMode: 'FLAT' | 'ZONE';
    flatFeeCents: number;
    estimatedMinutes: number;
    zones: Array<{ fromKm: number; toKm: number; feeCents: number }>;
  } | null {
    const maxRadiusKm = parseKm(this.maxRadiusKm());
    const flatFeeCents = reaisToCents(this.flatFee());
    const estimatedMinutes = Number(this.estimatedMinutes().trim());
    if (
      maxRadiusKm === null ||
      maxRadiusKm <= 0 ||
      flatFeeCents === null ||
      !Number.isInteger(estimatedMinutes) ||
      estimatedMinutes <= 0
    ) {
      return null;
    }

    const zones = [];
    for (const zone of this.zones()) {
      const fromKm = parseKm(zone.fromKm);
      const toKm = parseKm(zone.toKm);
      const feeCents = reaisToCents(zone.fee);
      if (
        fromKm === null ||
        toKm === null ||
        feeCents === null ||
        fromKm >= toKm
      ) {
        return null;
      }
      zones.push({ fromKm, toKm, feeCents });
    }

    return {
      deliveryEnabled: this.deliveryEnabled(),
      pickupEnabled: this.pickupEnabled(),
      maxRadiusKm,
      feeMode: this.feeMode(),
      flatFeeCents,
      estimatedMinutes,
      zones,
    };
  }

  private touch(): void {
    this.dirty.set(true);
    this.notice.set('');
    this.error.set('');
  }

  private key(): string {
    const key = `zone-${this.nextKey}`;
    this.nextKey += 1;
    return key;
  }
}

function checked(event: Event): boolean {
  const input = event.target;
  return input instanceof HTMLInputElement && input.checked;
}

function text(event: Event): string {
  const input = event.target;
  if (
    input instanceof HTMLInputElement ||
    input instanceof HTMLSelectElement ||
    input instanceof HTMLTextAreaElement
  ) {
    return input.value;
  }
  return '';
}

function parseKm(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  return Number(normalized);
}

function formatKm(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}
