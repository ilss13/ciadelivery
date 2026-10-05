import { DomainException } from '@ciadelivery/shared';
import { Role } from './permissions';
import { UserStatus } from './user';

export function assertLastOwnerRemains(input: {
  currentRole: Role;
  currentStatus: UserStatus;
  nextStatus: UserStatus;
  activeOwnerCount: number;
}): void {
  const disablingLastOwner =
    input.currentRole === 'OWNER' &&
    input.currentStatus === 'ACTIVE' &&
    input.nextStatus === 'DISABLED' &&
    input.activeOwnerCount <= 1;
  if (disablingLastOwner) {
    throw new DomainException(
      'LAST_OWNER',
      'The last owner cannot be disabled',
      409,
    );
  }
}
