import { ValidationError } from 'class-validator';

export interface FieldConstraintDetail {
  field: string;
  constraint: string;
}

export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): FieldConstraintDetail[] {
  const details: FieldConstraintDetail[] = [];

  for (const error of errors) {
    const field =
      parent.length > 0 ? `${parent}.${error.property}` : error.property;
    const constraints = error.constraints ?? {};

    for (const constraint of Object.keys(constraints)) {
      details.push({ field, constraint });
    }

    if (error.children !== undefined && error.children.length > 0) {
      details.push(...flattenValidationErrors(error.children, field));
    }
  }

  return details;
}
