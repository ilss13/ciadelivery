import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { AssignmentRecord } from './assignment';

export interface NewAssignment {
  id: string;
  tenantId: string;
  orderId: string;
  courierId: string;
  status: 'ASSIGNED';
  assignedBy: string;
  assignedAt: Date;
}

export interface Assignments {
  insert(assignment: NewAssignment, tx: TransactionContext): Promise<void>;
  lockByOrder(
    tenantId: string,
    orderId: string,
    tx: TransactionContext,
  ): Promise<AssignmentRecord | null>;
  markOut(
    tenantId: string,
    orderId: string,
    at: Date,
    tx: TransactionContext,
  ): Promise<boolean>;
  markDelivered(
    tenantId: string,
    orderId: string,
    at: Date,
    tx: TransactionContext,
  ): Promise<boolean>;
}

export const ASSIGNMENTS = Symbol('ASSIGNMENTS');
