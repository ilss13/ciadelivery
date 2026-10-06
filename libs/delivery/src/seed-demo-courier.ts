import { randomUUID } from 'node:crypto';
import { DemoTenantSeed } from '@ciadelivery/branding';
import {
  APP_CONFIG,
  AppConfig,
  DomainException,
  JsonLogger,
} from '@ciadelivery/shared';
import {
  STORES,
  Stores,
  TENANT_REPOSITORY,
  TenantRepository,
  UNIT_OF_WORK,
  UnitOfWork,
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
import { COURIERS, Couriers } from './domain/couriers.port';

const PIZZA_SLUG = 'pizzariadoze';
const COURIER_EMAIL = 'pizzariadoze-courier@example.com';
const COURIER_NAME = 'Lia Entregas';
const COURIER_PHONE = '11933330000';

@Injectable()
export class DemoCourierSeed implements OnModuleInit {
  private readonly logger = new JsonLogger();

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(STORES) private readonly stores: Stores,
    @Inject(USERS) private readonly users: Users,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(COURIERS) private readonly couriers: Couriers,
    private readonly demoTenants: DemoTenantSeed,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.seedDemo) {
      return;
    }
    await this.demoTenants.ensureReady();

    assertStrongPassword(this.config.demoOwnerPassword);
    const tenant = await this.tenants.findBySlug(PIZZA_SLUG);
    if (tenant === null) {
      throw new Error(`Demo tenant ${PIZZA_SLUG} was not created`);
    }
    const store = await this.stores.findByTenantId(tenant.id);
    if (store === null) {
      throw new Error(`Demo store for ${PIZZA_SLUG} was not created`);
    }

    await this.ensure(tenant.id, store.id);
    this.logger.log(`Demo courier ready ${COURIER_EMAIL}`, 'DemoCourierSeed');
  }

  private async ensure(tenantId: string, storeId: string): Promise<void> {
    const email = normalizeEmail(COURIER_EMAIL);
    const existing = await this.users.findByEmail(email);
    if (existing !== null) {
      if (existing.role !== 'COURIER' || existing.tenantId !== tenantId) {
        throw new Error(`Demo courier email ${email} belongs to another account`);
      }
      const linked = await this.couriers.findByUserId(tenantId, existing.id);
      if (linked !== null) {
        return;
      }
      await this.insertCourier(tenantId, storeId, existing.id);
      return;
    }

    const now = new Date();
    const userId = randomUUID();
    const passwordHash = await this.hasher.hash(this.config.demoOwnerPassword);
    try {
      await this.unitOfWork.run(async (tx) => {
        await this.users.insert(
          {
            id: userId,
            tenantId,
            storeId,
            name: COURIER_NAME,
            email,
            passwordHash,
            role: 'COURIER',
            status: 'ACTIVE',
            createdAt: now,
            updatedAt: now,
          },
          [],
          tx,
        );
        await this.couriers.insert(
          {
            id: randomUUID(),
            tenantId,
            storeId,
            userId,
            name: COURIER_NAME,
            phone: COURIER_PHONE,
            status: 'AVAILABLE',
            active: true,
            vehicleType: null,
            notes: null,
            createdAt: now,
            updatedAt: now,
          },
          tx,
        );
      });
    } catch (error) {
      if (error instanceof DomainException && error.code === 'EMAIL_TAKEN') {
        return;
      }
      throw error;
    }
  }

  private async insertCourier(
    tenantId: string,
    storeId: string,
    userId: string,
  ): Promise<void> {
    const now = new Date();
    await this.unitOfWork.run((tx) =>
      this.couriers.insert(
        {
          id: randomUUID(),
          tenantId,
          storeId,
          userId,
          name: COURIER_NAME,
          phone: COURIER_PHONE,
          status: 'AVAILABLE',
          active: true,
          vehicleType: null,
          notes: null,
          createdAt: now,
          updatedAt: now,
        },
        tx,
      ),
    );
  }
}
