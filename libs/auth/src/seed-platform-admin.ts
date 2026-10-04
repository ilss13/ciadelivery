import { APP_CONFIG, AppConfig, DomainException } from '@ciadelivery/shared';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '@ciadelivery/tenancy';
import {
  PASSWORD_HASHER,
  PasswordHasher,
  USERS,
  Users,
  assertStrongPassword,
  normalizeEmail,
} from '@ciadelivery/users';
import { randomUUID } from 'node:crypto';

@Injectable()
export class PlatformAdminSeed implements OnModuleInit {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(USERS) private readonly users: Users,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.seedPlatformAdmin) {
      return;
    }

    const email = normalizeEmail(this.config.platformAdminEmail);
    const existing = await this.users.findByEmail(email);
    if (existing !== null) {
      return;
    }

    assertStrongPassword(this.config.platformAdminPassword);
    const now = new Date();
    const passwordHash = await this.hasher.hash(
      this.config.platformAdminPassword,
    );
    try {
      await this.unitOfWork.run((tx) =>
        this.users.insert(
          {
            id: randomUUID(),
            tenantId: null,
            storeId: null,
            name: 'Platform admin',
            email,
            passwordHash,
            role: 'SUPER_ADMIN',
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
}
