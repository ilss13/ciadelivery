import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { FileInput, prepareUpload, StoredFile } from './image-file';
import { StorageProvider } from './storage-provider';

export interface S3StorageOptions {
  endpoint: string;
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
  client?: S3Client;
}

export class S3Storage implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.endpoint = options.endpoint.replace(/\/$/, '');
    this.client =
      options.client ??
      new S3Client({
        region: options.region,
        endpoint: this.endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: options.accessKey,
          secretAccessKey: options.secretKey,
        },
      });
  }

  async upload(file: FileInput): Promise<StoredFile> {
    const prepared = prepareUpload(file);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: prepared.key,
        Body: prepared.buffer,
        ContentType: prepared.contentType,
      }),
    );
    return { key: prepared.key, url: this.publicUrl(prepared.key) };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  publicUrl(key: string): string {
    return `${this.endpoint}/${this.bucket}/${key}`;
  }
}
