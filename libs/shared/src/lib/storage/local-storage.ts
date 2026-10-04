import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import {
  contentTypeForKey,
  FileInput,
  isStorageKey,
  prepareUpload,
  StoredFile,
} from './image-file';
import { StorageProvider } from './storage-provider';

export class LocalStorage implements StorageProvider {
  private readonly directory: string;

  constructor(
    directory: string,
    private readonly publicBaseUrl: string,
  ) {
    this.directory = resolve(directory);
  }

  async upload(file: FileInput): Promise<StoredFile> {
    const prepared = prepareUpload(file);
    const target = this.resolveKey(prepared.key);
    if (target === null) {
      throw new Error('The storage key is outside the local directory');
    }

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, prepared.buffer);
    return { key: prepared.key, url: this.publicUrl(prepared.key) };
  }

  async delete(key: string): Promise<void> {
    const target = this.resolveKey(key);
    if (target === null) {
      return;
    }

    await rm(target, { force: true });
  }

  async read(key: string): Promise<Buffer | null> {
    const target = this.resolveKey(key);
    if (target === null) {
      return null;
    }

    try {
      const root = await existingRealpath(this.directory);
      const filePath = await realpath(target);
      if (root === null || !isInside(root, filePath)) {
        return null;
      }
      return await readFile(filePath);
    } catch (error) {
      if (isMissing(error)) {
        return null;
      }
      throw error;
    }
  }

  publicUrl(key: string): string {
    const base = this.publicBaseUrl.replace(/\/$/, '');
    return `${base}/media/${key}`;
  }

  contentType(key: string): string | null {
    return contentTypeForKey(key);
  }

  private resolveKey(key: string): string | null {
    if (!isStorageKey(key) || key.includes('\\') || key.includes('\0')) {
      return null;
    }

    const target = resolve(this.directory, key);
    if (!isInside(this.directory, target)) {
      return null;
    }

    return target;
  }
}

function isInside(root: string, target: string): boolean {
  const fromRoot = relative(root, target);
  return fromRoot.length > 0 && !fromRoot.startsWith('..') && !isAbsolute(fromRoot);
}

async function existingRealpath(path: string): Promise<string | null> {
  try {
    return await realpath(path);
  } catch (error) {
    if (isMissing(error)) {
      return null;
    }
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
