import { DomainException } from '@ciadelivery/shared';
import { RequestActor } from '@ciadelivery/users';
import {
  CategoryPatch,
  OptionGroupPatch,
  OptionPatch,
  ProductPatch,
} from '../application/admin-catalog';

export function actorFrom(request: { actor?: RequestActor }): RequestActor {
  if (request.actor === undefined) {
    throw new DomainException(
      'UNAUTHENTICATED',
      'Authentication is required',
      401,
    );
  }

  return request.actor;
}

export function categoryPatch(body: {
  name?: string;
  description?: string | null;
  sortOrder?: number;
  active?: boolean;
}): CategoryPatch {
  return {
    ...(body.name === undefined ? {} : { name: body.name }),
    ...(body.description === undefined ? {} : { description: body.description }),
    ...(body.sortOrder === undefined ? {} : { sortOrder: body.sortOrder }),
    ...(body.active === undefined ? {} : { active: body.active }),
  };
}

export function productPatch(body: {
  categoryId?: string;
  name?: string;
  description?: string | null;
  priceCents?: number;
  sku?: string | null;
  active?: boolean;
  available?: boolean;
  sortOrder?: number;
}): ProductPatch {
  return {
    ...(body.categoryId === undefined ? {} : { categoryId: body.categoryId }),
    ...(body.name === undefined ? {} : { name: body.name }),
    ...(body.description === undefined ? {} : { description: body.description }),
    ...(body.priceCents === undefined ? {} : { priceCents: body.priceCents }),
    ...(body.sku === undefined ? {} : { sku: body.sku }),
    ...(body.active === undefined ? {} : { active: body.active }),
    ...(body.available === undefined ? {} : { available: body.available }),
    ...(body.sortOrder === undefined ? {} : { sortOrder: body.sortOrder }),
  };
}

export function groupPatch(body: {
  name?: string;
  minSelect?: number;
  maxSelect?: number;
  sortOrder?: number;
}): OptionGroupPatch {
  return {
    ...(body.name === undefined ? {} : { name: body.name }),
    ...(body.minSelect === undefined ? {} : { minSelect: body.minSelect }),
    ...(body.maxSelect === undefined ? {} : { maxSelect: body.maxSelect }),
    ...(body.sortOrder === undefined ? {} : { sortOrder: body.sortOrder }),
  };
}

export function optionPatch(body: {
  name?: string;
  priceCents?: number;
  available?: boolean;
  sortOrder?: number;
}): OptionPatch {
  return {
    ...(body.name === undefined ? {} : { name: body.name }),
    ...(body.priceCents === undefined ? {} : { priceCents: body.priceCents }),
    ...(body.available === undefined ? {} : { available: body.available }),
    ...(body.sortOrder === undefined ? {} : { sortOrder: body.sortOrder }),
  };
}
