export function isMysqlDuplicate(error: unknown): boolean {
  return mysqlMessage(error).length > 0 && mysqlCode(error) === 'ER_DUP_ENTRY';
}

export function mysqlMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return '';
  }

  const candidate = error as {
    message?: string;
    sqlMessage?: string;
    driverError?: { sqlMessage?: string; message?: string };
  };
  return (
    candidate.driverError?.sqlMessage ??
    candidate.sqlMessage ??
    candidate.driverError?.message ??
    candidate.message ??
    ''
  );
}

function mysqlCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const candidate = error as {
    code?: string;
    driverError?: { code?: string };
  };
  return candidate.code ?? candidate.driverError?.code;
}
