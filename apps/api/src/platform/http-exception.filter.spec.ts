import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import {
  DomainException,
  HttpExceptionFilter,
  mapException,
  requestContext,
} from '@ciadelivery/shared';

function createHost(header?: string) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const setHeader = jest.fn();
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: header === undefined ? {} : { 'x-request-id': header },
      }),
      getResponse: () => ({
        status,
        getHeader: () => undefined,
        setHeader,
      }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json, setHeader };
}

describe('mapException', () => {
  it('maps an unknown route to ROUTE_NOT_FOUND', () => {
    expect(mapException(new NotFoundException('Cannot GET /missing'))).toEqual({
      statusCode: 404,
      code: 'ROUTE_NOT_FOUND',
      message: 'The requested route does not exist',
      details: null,
    });
  });

  it('keeps the domain code and status', () => {
    const exception = new DomainException(
      'ORDER_INVALID_TRANSITION',
      'The requested order transition is not allowed',
      409,
    );

    expect(mapException(exception)).toEqual({
      statusCode: 409,
      code: 'ORDER_INVALID_TRANSITION',
      message: 'The requested order transition is not allowed',
      details: null,
    });
  });
});

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('returns the error contract with the active request id', () => {
    const { host, status, json } = createHost();

    requestContext.run({ requestId: 'req-123' }, () => {
      filter.catch(
        new DomainException('STORE_CLOSED', 'The store is closed', 409, null),
        host,
      );
    });

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'STORE_CLOSED',
        message: 'The store is closed',
        details: null,
        requestId: 'req-123',
      },
    });
  });

  it('hides unexpected error details from the response', () => {
    const { host, status, json } = createHost('incoming-id');
    const stdout = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    filter.catch(new Error('password=hunter2'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: null,
        requestId: 'incoming-id',
      },
    });
    const logged = stdout.mock.calls.map((call) => String(call[0])).join('');
    expect(logged).not.toContain('hunter2');
    stdout.mockRestore();
  });
});
