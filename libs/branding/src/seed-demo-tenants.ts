import { randomUUID } from 'node:crypto';
import {
  APP_CONFIG,
  AppConfig,
  DomainException,
  JsonLogger,
} from '@ciadelivery/shared';
import {
  CreateTenant,
  STORES,
  Stores,
  TENANT_REPOSITORY,
  TenantRepository,
  UNIT_OF_WORK,
  UnitOfWork,
  runWithTenant,
} from '@ciadelivery/tenancy';
import {
  PASSWORD_HASHER,
  PasswordHasher,
  USERS,
  Users,
  assertStrongPassword,
  normalizeEmail,
} from '@ciadelivery/users';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { BrandingDraft } from './domain/branding';
import { BRANDING, BrandingRepository } from './domain/branding-repository';
import { demoWeek } from './domain/business-hours';
import {
  BUSINESS_HOURS,
  BusinessHoursRepository,
} from './domain/business-hours-repository';

interface DemoTenant {
  slug: string;
  name: string;
  phone: string;
  email: string;
  ownerName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  address: {
    line: string;
    number: string;
    district: string;
    city: string;
    state: string;
    postalCode: string;
  };
}

const DEMOS: readonly DemoTenant[] = [
  {
    slug: 'pizzariadoze',
    name: 'Pizzaria do Ze',
    phone: '11911110000',
    email: 'pizzariadoze-owner@example.com',
    ownerName: 'Olivia Pizzaria',
    primaryColor: '#C0392B',
    secondaryColor: '#922B21',
    accentColor: '#F5B7B1',
    address: {
      line: 'Rua da Pizza',
      number: '12',
      district: 'Centro',
      city: 'Sao Paulo',
      state: 'SP',
      postalCode: '01001-000',
    },
  },
  {
    slug: 'burgercentral',
    name: 'Burger Central',
    phone: '11922220000',
    email: 'burgercentral-owner@example.com',
    ownerName: 'Bruno Burger',
    primaryColor: '#E67E22',
    secondaryColor: '#D35400',
    accentColor: '#FDEBD0',
    address: {
      line: 'Avenida do Hamburguer',
      number: '50',
      district: 'Jardins',
      city: 'Campinas',
      state: 'SP',
      postalCode: '13010-000',
    },
  },
];

@Injectable()
export class DemoTenantSeed implements OnModuleInit {
  private readonly logger = new JsonLogger();

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(STORES) private readonly stores: Stores,
    @Inject(USERS) private readonly users: Users,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(BRANDING) private readonly branding: BrandingRepository,
    @Inject(BUSINESS_HOURS) private readonly hours: BusinessHoursRepository,
    private readonly createTenant: CreateTenant,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.seedDemo) {
      return;
    }

    assertStrongPassword(this.config.demoOwnerPassword);
    for (const demo of DEMOS) {
      await this.ensure(demo);
      this.logger.log(`Demo tenant ready ${demo.slug}`, 'DemoTenantSeed');
    }
  }

  private async ensure(demo: DemoTenant): Promise<void> {
    const email = normalizeEmail(demo.email);
    let tenant = await this.tenants.findBySlug(demo.slug);
    if (tenant === null) {
      try {
        const created = await this.createTenant.execute({
          name: demo.name,
          slug: demo.slug,
          phone: demo.phone,
          address: demo.address,
        });
        tenant = created.tenant;
      } catch (error) {
        if (
          !(error instanceof DomainException) ||
          error.code !== 'TENANT_SLUG_TAKEN'
        ) {
          throw error;
        }
        tenant = await this.tenants.findBySlug(demo.slug);
      }
    }

    if (tenant === null) {
      throw new Error(`Demo tenant ${demo.slug} was not created`);
    }

    const store = await this.stores.findByTenantId(tenant.id);
    if (store === null) {
      throw new Error(`Demo store for ${demo.slug} was not created`);
    }

    await this.ensureOwner(tenant.id, store.id, demo.ownerName, email);
    await runWithTenant(tenant, () => this.ensurePresentation(demo, email));
  }

  private async ensureOwner(
    tenantId: string,
    storeId: string,
    name: string,
    email: string,
  ): Promise<void> {
    if ((await this.users.findByEmail(email)) !== null) {
      return;
    }

    const now = new Date();
    const passwordHash = await this.hasher.hash(this.config.demoOwnerPassword);
    try {
      await this.unitOfWork.run((tx) =>
        this.users.insert(
          {
            id: randomUUID(),
            tenantId,
            storeId,
            name,
            email,
            passwordHash,
            role: 'OWNER',
            status: 'ACTIVE',
            createdAt: now,
            updatedAt: now,
          },
          [],
          tx,
        ),
      );
    } catch (error) {
      if (error instanceof DomainException && error.code === 'EMAIL_TAKEN') {
        return;
      }
      throw error;
    }
  }

  private async ensurePresentation(
    demo: DemoTenant,
    email: string,
  ): Promise<void> {
    if ((await this.branding.findCurrent()) === null) {
      const draft: BrandingDraft = {
        displayName: demo.name,
        logoUrl: null,
        faviconUrl: null,
        bannerUrl: null,
        primaryColor: demo.primaryColor,
        secondaryColor: demo.secondaryColor,
        accentColor: demo.accentColor,
        fontFamily: null,
        seoTitle: demo.name,
        seoDescription: '',
        instagramUrl: null,
        facebookUrl: null,
        websiteUrl: null,
        contactEmail: email,
        whatsappPhone: demo.phone,
      };
      await this.branding.save(draft);
    }

    if ((await this.hours.listCurrent()).length === 0) {
      await this.hours.replace(demoWeek());
    }
  }
}
