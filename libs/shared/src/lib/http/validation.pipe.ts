import { ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { DomainException } from './domain-exception';
import { flattenValidationErrors } from './validation-details';

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new DomainException(
        'VALIDATION_ERROR',
        'The request payload is invalid',
        400,
        flattenValidationErrors(errors),
      ),
  });
}
