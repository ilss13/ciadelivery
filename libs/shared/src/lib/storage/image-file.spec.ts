import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DomainException } from '../http/domain-exception';
import { assertImageFile, prepareUpload } from './image-file';
import { LocalStorage } from './local-storage';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const tenantId = '11111111-1111-4111-8111-111111111111';

describe('image file validation', () => {
  it('accepts a PNG recognized by its magic bytes', () => {
    expect(
      assertImageFile({
        buffer: PNG_1X1,
        mimeType: 'image/png',
        size: PNG_1X1.length,
      }),
    ).toBe('png');
  });

  it('rejects text renamed to a png extension', () => {
    const buffer = Buffer.from('this is not a png');
    expect(() =>
      assertImageFile({
        buffer,
        mimeType: 'image/png',
        size: buffer.length,
      }),
    ).toThrow(DomainException);
    expect(() =>
      assertImageFile({
        buffer,
        mimeType: 'image/png',
        size: buffer.length,
      }),
    ).toThrow(
      expect.objectContaining({ code: 'INVALID_FILE', statusCode: 400 }),
    );
  });
});

describe('local storage', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'ciadelivery-media-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('writes a tenant-prefixed key and refuses to read outside that prefix', async () => {
    const storage = new LocalStorage(directory, 'http://localhost:3000');
    const stored = await storage.upload({
      buffer: PNG_1X1,
      mimeType: 'image/png',
      size: PNG_1X1.length,
      originalName: 'foto.png',
      tenantId,
      kind: 'products',
    });

    expect(stored.key.startsWith(`${tenantId}/products/`)).toBe(true);
    expect(stored.url).toBe(`http://localhost:3000/media/${stored.key}`);
    await expect(storage.read(stored.key)).resolves.toEqual(PNG_1X1);
    await expect(storage.read(`../${randomUUID()}.png`)).resolves.toBeNull();
    await expect(
      storage.read(`${tenantId}/products/${randomUUID()}.txt`),
    ).resolves.toBeNull();
  });
});

describe('prepareUpload', () => {
  it('uses the original name only as the extension', () => {
    const prepared = prepareUpload({
      buffer: PNG_1X1,
      mimeType: 'image/png',
      size: PNG_1X1.length,
      originalName: 'cardapio.PNG',
      tenantId,
      kind: 'logos',
    });

    expect(prepared.key.endsWith('.png')).toBe(true);
    expect(prepared.contentType).toBe('image/png');
  });
});
