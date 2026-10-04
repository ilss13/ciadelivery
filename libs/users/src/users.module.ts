import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { USERS } from './domain/users.port';
import { UserPermissionOverrideEntity } from './infrastructure/user-permission-override.entity';
import { TypeOrmUsers } from './infrastructure/typeorm-users';
import { UserEntity } from './infrastructure/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserPermissionOverrideEntity]),
  ],
  providers: [TypeOrmUsers, { provide: USERS, useExisting: TypeOrmUsers }],
  exports: [USERS],
})
export class UsersModule {}
