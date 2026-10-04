import { DatabaseReady } from '@ciadelivery/shared';
import { Injectable } from '@nestjs/common';
import { TransactionContext, UnitOfWork } from '../domain/transaction-context';

@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(private readonly database: DatabaseReady) {}

  async run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    const dataSource = await this.database.ensure();
    return dataSource.transaction((manager) =>
      work(manager as unknown as TransactionContext),
    );
  }
}
