import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { currentRequestId } from './request-context';
import { DomainException } from './domain-exception';
import { resolveRequestId } from './request-id';
import { JsonLogger } from '../logging/json-logger';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: unknown;
    requestId: string;
  };
}

interface HttpRequestLike {
  headers: Record<string, string | string[] | undefined>;
}

interface HttpResponseLike {
  status(code: number): { json(body: unknown): void };
  getHeader(name: string): unknown;
  setHeader(name: string, value: string): void;
}

interface MappedException {
  statusCode: number;
  code: string;
  message: string;
  details: unknown;
}

export function mapException(exception: unknown): MappedException {
  if (exception instanceof DomainException) {
    return {
      statusCode: exception.statusCode,
      code: exception.code,
      message: exception.message,
      details: exception.details,
    };
  }

  if (isRejectedUpload(exception)) {
    return {
      statusCode: 400,
      code: 'INVALID_FILE',
      message: 'The file is not an accepted image',
      details: null,
    };
  }

  if (exception instanceof NotFoundException) {
    return {
      statusCode: 404,
      code: 'ROUTE_NOT_FOUND',
      message: 'The requested route does not exist',
      details: null,
    };
  }

  const statusCode = readStatusCode(exception);
  if (statusCode === 413) {
    return {
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'The request body exceeds the size limit',
      details: null,
    };
  }

  if (exception instanceof HttpException) {
    return {
      statusCode: exception.getStatus(),
      code: 'HTTP_ERROR',
      message: 'The request could not be completed',
      details: null,
    };
  }

  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    details: null,
  };
}

function isRejectedUpload(exception: unknown): boolean {
  if (typeof exception !== 'object' || exception === null || !('code' in exception)) {
    return false;
  }

  return (
    exception.code === 'LIMIT_FILE_SIZE' ||
    exception.code === 'LIMIT_FILE_COUNT' ||
    exception.code === 'LIMIT_UNEXPECTED_FILE'
  );
}

function readStatusCode(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) {
    return undefined;
  }

  if ('statusCode' in exception && typeof exception.statusCode === 'number') {
    return exception.statusCode;
  }

  if ('status' in exception && typeof exception.status === 'number') {
    return exception.status;
  }

  return undefined;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new JsonLogger();

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<HttpRequestLike>();
    const response = http.getResponse<HttpResponseLike>();
    const mapped = mapException(exception);
    const requestId =
      currentRequestId() ?? resolveRequestId(request.headers['x-request-id']);

    if (response.getHeader('X-Request-Id') === undefined) {
      response.setHeader('X-Request-Id', requestId);
    }

    if (mapped.statusCode >= 500 && mapped.code !== 'PAYLOAD_TOO_LARGE') {
      const message =
        exception instanceof Error ? exception.message : 'Unhandled error';
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(message, stack, 'HttpExceptionFilter');
    }

    const body: ApiErrorBody = {
      error: {
        code: mapped.code,
        message: mapped.message,
        details: mapped.details,
        requestId,
      },
    };

    response.status(mapped.statusCode).json(body);
  }
}
