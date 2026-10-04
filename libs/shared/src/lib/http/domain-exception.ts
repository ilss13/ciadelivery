export class DomainException extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details: unknown;

  constructor(
    code: string,
    message: string,
    statusCode: number,
    details: unknown = null,
  ) {
    super(message);
    this.name = 'DomainException';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
