import { TransactionContext } from '@ciadelivery/tenancy/domain';

export interface UserChange {
  tenantId: string;
  actor: { userId: string; role: string };
  action: 'user.created' | 'user.updated';
  userId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
}

export interface UserChanges {
  record(change: UserChange, tx: TransactionContext): Promise<void>;
}

export const USER_CHANGES = Symbol('USER_CHANGES');
