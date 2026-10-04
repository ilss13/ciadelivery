import { randomUUID } from 'node:crypto';
import { DomainException } from '../http/domain-exception';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export const IMAGE_KINDS = ['products', 'logos', 'favicons', 'banners'] as const;

export type ImageKind = (typeof IMAGE_KINDS)[number];

export type ImageType = 'jpeg' | 'png' | 'webp';

export interface FileInput {
  buffer: Buffer;
  mimeType: string;
  size: number;
  originalName: string;
  tenantId: string;
  kind: ImageKind;
}

export interface StoredFile {
  key: string;
  url: string;
}

export interface PreparedImage {
  key: string;
  buffer: Buffer;
  contentType: string;
}

const MIME_BY_TYPE: Record<ImageType, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const STORAGE_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(products|logos|favicons|banners)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/;

export function isStorageKey(value: string): boolean {
  return STORAGE_KEY.test(value);
}

export function storageKeyFromReference(value: string): string | null {
  const match = value.match(STORAGE_KEY);
  if (match?.[0] !== undefined) {
    return match[0];
  }

  try {
    const pathname = value.startsWith('/') ? value : new URL(value).pathname;
    const embedded = pathname.match(STORAGE_KEY);
    return embedded?.[0] ?? null;
  } catch {
    return null;
  }
}

export function resolveStoredImage(
  stored: string | null,
  publicUrl: (key: string) => string,
): string | null {
  if (stored === null || stored.length === 0) {
    return null;
  }

  const key = storageKeyFromReference(stored);
  if (key === null) {
    return stored;
  }

  return publicUrl(key);
}

export function assertImageFile(file: {
  buffer: Buffer;
  mimeType: string;
  size: number;
}): ImageType {
  if (
    file.size <= 0 ||
    file.size > MAX_IMAGE_BYTES ||
    file.buffer.length === 0 ||
    file.buffer.length > MAX_IMAGE_BYTES
  ) {
    throw invalidFile();
  }

  const detected = detectImageType(file.buffer);
  if (detected === null || file.mimeType.toLowerCase() !== MIME_BY_TYPE[detected]) {
    throw invalidFile();
  }

  return detected;
}

export function prepareUpload(file: FileInput): PreparedImage {
  const type = assertImageFile(file);
  const key = `${file.tenantId}/${file.kind}/${randomUUID()}.${extensionFor(type, file.originalName)}`;
  if (!isStorageKey(key)) {
    throw invalidFile();
  }

  return {
    key,
    buffer: file.buffer,
    contentType: MIME_BY_TYPE[type],
  };
}

export function contentTypeForKey(key: string): string | null {
  if (!isStorageKey(key)) {
    return null;
  }
  if (key.endsWith('.png')) {
    return 'image/png';
  }
  if (key.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

export function detectImageType(buffer: Buffer): ImageType | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpeg';
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return 'png';
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }

  return null;
}

function extensionFor(type: ImageType, originalName: string): string {
  const extension = originalName.split('.').pop()?.toLowerCase() ?? '';
  if (type === 'jpeg' && (extension === 'jpg' || extension === 'jpeg')) {
    return extension;
  }
  if (type === 'png') {
    return 'png';
  }
  if (type === 'webp') {
    return 'webp';
  }
  return 'jpg';
}

function invalidFile(): DomainException {
  return new DomainException(
    'INVALID_FILE',
    'The file is not an accepted image',
    400,
  );
}
