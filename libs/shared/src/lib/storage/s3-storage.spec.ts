jest.mock('@aws-sdk/client-s3', () => {
  const send = jest.fn();
  return {
    __send: send,
    S3Client: jest.fn().mockImplementation(() => ({ send })),
    PutObjectCommand: jest.fn().mockImplementation((input: unknown) => ({
      name: 'PutObject',
      input,
    })),
    DeleteObjectCommand: jest.fn().mockImplementation((input: unknown) => ({
      name: 'DeleteObject',
      input,
    })),
  };
});

import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { S3Storage } from './s3-storage';

const mockSend = (
  jest.requireMock('@aws-sdk/client-s3') as { __send: jest.Mock }
).__send;

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('S3Storage', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockSend.mockResolvedValue({});
  });

  it('uploads and deletes through the S3 client', async () => {
    const storage = new S3Storage({
      endpoint: 'http://minio:9000',
      bucket: 'media',
      region: 'us-east-1',
      accessKey: 'access',
      secretKey: 'secret',
    });

    const stored = await storage.upload({
      buffer: PNG_1X1,
      mimeType: 'image/png',
      size: PNG_1X1.length,
      originalName: 'foto.png',
      tenantId: '11111111-1111-4111-8111-111111111111',
      kind: 'products',
    });

    expect(stored.url).toBe(`http://minio:9000/media/${stored.key}`);
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'media',
        Key: stored.key,
        Body: PNG_1X1,
        ContentType: 'image/png',
      }),
    );
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'PutObject' }),
    );

    await storage.delete(stored.key);
    expect(DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: 'media',
      Key: stored.key,
    });
  });
});
