import { FileInput, storageKeyFromReference, StoredFile } from './image-file';

export interface StorageProvider {
  upload(file: FileInput): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

export interface WarningLog {
  warn(message: string): void;
}

export const STORAGE = Symbol('STORAGE');

export async function discardStoredFile(
  storage: StorageProvider,
  tenantId: string,
  previous: string | null,
  replacementKey: string | null,
  log: WarningLog,
): Promise<void> {
  if (previous === null || previous.length === 0 || previous === replacementKey) {
    return;
  }

  const key = storageKeyFromReference(previous);
  if (
    key === null ||
    key === replacementKey ||
    !key.startsWith(`${tenantId}/`)
  ) {
    return;
  }

  try {
    await storage.delete(key);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    log.warn(`Failed to delete replaced image ${key}: ${reason}`);
  }
}
