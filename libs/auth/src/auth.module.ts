import { APP_CONFIG, AppConfig } from '@ciadelivery/shared';
import { StoresModule } from '@ciadelivery/stores';
import {
  TENANT_REPOSITORY,
  TenancyCoreModule,
  TenantRepository,
  UNIT_OF_WORK,
  UnitOfWork,
  SuperAdminGuard,
} from '@ciadelivery/tenancy';
import {
  PASSWORD_HASHER,
  PasswordHasher,
  USERS,
  Users,
  UsersModule,
  CreateTenantOwner,
  CreateTenantUser,
  GetTenantUser,
  ListTenantUsers,
  UpdateTenantUser,
} from '@ciadelivery/users';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ForgotPassword,
  GetSession,
  ResetPassword,
} from './application/password-reset';
import { Login, Logout, RefreshAccess } from './application/session';
import {
  AUTH_SESSIONS,
  AuthSessions,
  LOGIN_RATE_LIMIT,
  LoginRateLimit,
} from './domain/auth-sessions';
import { MAIL_PROVIDER, MailProvider } from './domain/mail-provider';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { LoginAttemptEntity } from './infrastructure/login-attempt.entity';
import { LoggingMailProvider } from './infrastructure/logging-mail-provider';
import { PasswordResetTokenEntity } from './infrastructure/password-reset.entity';
import { RedisLoginRateLimit } from './infrastructure/redis-login-rate-limit';
import { RefreshTokenEntity } from './infrastructure/refresh-token.entity';
import { TypeOrmAuthSessions } from './infrastructure/typeorm-auth-sessions';
import { AdminAccessLogInterceptor } from './presentation/admin-access-log.interceptor';
import { AdminUsersController } from './presentation/admin-users.controller';
import { AuthController } from './presentation/auth.controller';
import { AuthenticateGuard } from './presentation/authenticate.guard';
import { PermissionsGuard } from './presentation/permissions.guard';
import { PlatformOwnerController } from './presentation/platform-owner.controller';
import { PlatformAdminSeed } from './seed-platform-admin';

@Module({
  imports: [
    UsersModule,
    TenancyCoreModule,
    StoresModule,
    TypeOrmModule.forFeature([
      RefreshTokenEntity,
      LoginAttemptEntity,
      PasswordResetTokenEntity,
    ]),
  ],
  controllers: [AuthController, AdminUsersController, PlatformOwnerController],
  providers: [
    Argon2PasswordHasher,
    { provide: PASSWORD_HASHER, useExisting: Argon2PasswordHasher },
    TypeOrmAuthSessions,
    { provide: AUTH_SESSIONS, useExisting: TypeOrmAuthSessions },
    RedisLoginRateLimit,
    { provide: LOGIN_RATE_LIMIT, useExisting: RedisLoginRateLimit },
    LoggingMailProvider,
    { provide: MAIL_PROVIDER, useExisting: LoggingMailProvider },
    SuperAdminGuard,
    AuthenticateGuard,
    { provide: APP_GUARD, useExisting: AuthenticateGuard },
    AdminAccessLogInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: AdminAccessLogInterceptor },
    PermissionsGuard,
    PlatformAdminSeed,
    {
      provide: Login,
      useFactory: (
        users: Users,
        hasher: PasswordHasher,
        sessions: AuthSessions,
        rateLimit: LoginRateLimit,
        tenants: TenantRepository,
        config: AppConfig,
      ) =>
        new Login(
          users,
          hasher,
          sessions,
          rateLimit,
          tenants,
          config.jwtAccessSecret,
        ),
      inject: [
        USERS,
        PASSWORD_HASHER,
        AUTH_SESSIONS,
        LOGIN_RATE_LIMIT,
        TENANT_REPOSITORY,
        APP_CONFIG,
      ],
    },
    {
      provide: RefreshAccess,
      useFactory: (
        users: Users,
        sessions: AuthSessions,
        tenants: TenantRepository,
        unitOfWork: UnitOfWork,
        config: AppConfig,
      ) =>
        new RefreshAccess(
          users,
          sessions,
          tenants,
          unitOfWork,
          config.jwtAccessSecret,
        ),
      inject: [
        USERS,
        AUTH_SESSIONS,
        TENANT_REPOSITORY,
        UNIT_OF_WORK,
        APP_CONFIG,
      ],
    },
    {
      provide: Logout,
      useFactory: (sessions: AuthSessions) => new Logout(sessions),
      inject: [AUTH_SESSIONS],
    },
    {
      provide: ForgotPassword,
      useFactory: (users: Users, sessions: AuthSessions, mail: MailProvider) =>
        new ForgotPassword(users, sessions, mail),
      inject: [USERS, AUTH_SESSIONS, MAIL_PROVIDER],
    },
    {
      provide: ResetPassword,
      useFactory: (
        users: Users,
        hasher: PasswordHasher,
        sessions: AuthSessions,
        unitOfWork: UnitOfWork,
      ) => new ResetPassword(users, hasher, sessions, unitOfWork),
      inject: [USERS, PASSWORD_HASHER, AUTH_SESSIONS, UNIT_OF_WORK],
    },
    {
      provide: GetSession,
      useFactory: (users: Users) => new GetSession(users),
      inject: [USERS],
    },
    {
      provide: CreateTenantUser,
      useFactory: (
        users: Users,
        hasher: PasswordHasher,
        unitOfWork: UnitOfWork,
      ) => new CreateTenantUser(users, hasher, unitOfWork),
      inject: [USERS, PASSWORD_HASHER, UNIT_OF_WORK],
    },
    {
      provide: UpdateTenantUser,
      useFactory: (
        users: Users,
        hasher: PasswordHasher,
        unitOfWork: UnitOfWork,
      ) => new UpdateTenantUser(users, hasher, unitOfWork),
      inject: [USERS, PASSWORD_HASHER, UNIT_OF_WORK],
    },
    {
      provide: GetTenantUser,
      useFactory: (users: Users) => new GetTenantUser(users),
      inject: [USERS],
    },
    {
      provide: ListTenantUsers,
      useFactory: (users: Users) => new ListTenantUsers(users),
      inject: [USERS],
    },
    {
      provide: CreateTenantOwner,
      useFactory: (
        users: Users,
        hasher: PasswordHasher,
        unitOfWork: UnitOfWork,
      ) => new CreateTenantOwner(users, hasher, unitOfWork),
      inject: [USERS, PASSWORD_HASHER, UNIT_OF_WORK],
    },
  ],
  exports: [PASSWORD_HASHER],
})
export class AuthModule {}
