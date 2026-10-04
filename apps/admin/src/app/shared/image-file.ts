import { readErrorCode } from '../core/api-error';
import { apiUrl } from '../core/api-url';

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function imageFileMessage(file: {
  type: string;
  size: number;
}): string | null {
  if (!ACCEPTED_TYPES.has(file.type)) {
    return 'Envie uma imagem JPEG, PNG ou WebP.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'A imagem pode ter no máximo 2 MB.';
  }
  return null;
}

export function imageUploadError(error: unknown): string {
  const code = readErrorCode(error);
  if (code === 'INVALID_FILE') {
    return 'Envie uma imagem JPEG, PNG ou WebP de até 2 MB.';
  }
  if (code === 'FORBIDDEN') {
    return 'Você não tem permissão para enviar imagens.';
  }
  return 'Não foi possível enviar a imagem.';
}

export function mediaUrl(url: string | null): string | null {
  if (url === null || url.length === 0) {
    return null;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return apiUrl(url.startsWith('/') ? url : `/${url}`);
}
