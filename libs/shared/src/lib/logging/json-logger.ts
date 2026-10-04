import { LoggerService } from '@nestjs/common';
import { currentRequestId } from '../http/request-context';
import { redactSensitiveText, sanitizeLogValue } from './redact';

export interface JsonLogLine {
  timestamp: string;
  level: string;
  message: string;
  requestId: string | null;
  context: string | null;
}

export class JsonLogger implements LoggerService {
  log(message: unknown, context?: unknown): void {
    this.write('info', message, context);
  }

  error(message: unknown, stack?: unknown, context?: unknown): void {
    const stackText = typeof stack === 'string' ? stack : undefined;
    const text = toMessage(message);
    const combined =
      stackText === undefined
        ? text
        : `${text} ${stackText.replace(/\s+/g, ' ')}`.trim();
    this.write('error', combined, context);
  }

  warn(message: unknown, context?: unknown): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: unknown): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: unknown): void {
    this.write('verbose', message, context);
  }

  fatal(message: unknown, context?: unknown): void {
    this.write('fatal', message, context);
  }

  private write(level: string, message: unknown, context: unknown): void {
    const line: JsonLogLine = {
      timestamp: new Date().toISOString(),
      level,
      message: toMessage(message),
      requestId: currentRequestId(),
      context: typeof context === 'string' ? context : null,
    };
    process.stdout.write(`${JSON.stringify(line)}\n`);
  }
}

function toMessage(message: unknown): string {
  if (typeof message === 'string') {
    return redactSensitiveText(message).replace(/\s+/g, ' ').trim();
  }

  return JSON.stringify(sanitizeLogValue(message));
}
