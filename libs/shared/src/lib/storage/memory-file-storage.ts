import { Readable } from 'node:stream';

export function memoryFileStorage(): {
  _handleFile(
    request: unknown,
    file: { stream: Readable },
    callback: (
      error: Error | null,
      info?: { buffer: Buffer; size: number },
    ) => void,
  ): void;
  _removeFile(
    request: unknown,
    file: unknown,
    callback: (error: null) => void,
  ): void;
} {
  return {
    _handleFile(_request, file, callback): void {
      const chunks: Buffer[] = [];
      file.stream.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      file.stream.on('error', (error: Error) => callback(error));
      file.stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        callback(null, { buffer, size: buffer.length });
      });
    },
    _removeFile(_request, _file, callback): void {
      callback(null);
    },
  };
}
