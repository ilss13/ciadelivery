import { Controller, Get, Header, Inject, Param, StreamableFile } from '@nestjs/common';
import { DomainException } from '../http/domain-exception';
import { AppConfig, APP_CONFIG } from '../app-config';
import { contentTypeForKey, isStorageKey } from './image-file';
import { LocalStorage } from './local-storage';
import { STORAGE, StorageProvider } from './storage-provider';

@Controller('media')
export class MediaController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(STORAGE) private readonly storage: StorageProvider,
  ) {}

  @Get('*path')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async read(@Param('path') path: string | string[]): Promise<StreamableFile> {
    const key = joinPath(path);
    if (this.config.storageDriver !== 'local' || !isStorageKey(key)) {
      throw missingFile();
    }
    if (!(this.storage instanceof LocalStorage)) {
      throw missingFile();
    }

    const body = await this.storage.read(key);
    const contentType = contentTypeForKey(key);
    if (body === null || contentType === null) {
      throw missingFile();
    }

    return new StreamableFile(body, { type: contentType, disposition: 'inline' });
  }
}

function joinPath(path: string | string[]): string {
  return (Array.isArray(path) ? path.join('/') : path).replace(/^\/+/, '');
}

function missingFile(): DomainException {
  return new DomainException('NOT_FOUND', 'The file was not found', 404);
}
