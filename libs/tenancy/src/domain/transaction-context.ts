declare const transactionBrand: unique symbol;

export type TransactionContext = {
  readonly [transactionBrand]: true;
};

export interface UnitOfWork {
  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
