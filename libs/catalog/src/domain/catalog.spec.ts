import { DomainException } from '@ciadelivery/shared';
import { assertOptionSelection, assertPriceCents } from './catalog';

describe('catalog rules', () => {
  it('rejects an option group whose minimum exceeds the maximum', () => {
    expect(() => assertOptionSelection(2, 1)).toThrow(DomainException);
    expect(() => assertOptionSelection(2, 1)).toThrow(
      expect.objectContaining({
        code: 'INVALID_OPTION_GROUP',
        statusCode: 400,
      }),
    );
  });

  it('accepts a required single choice and an optional extra', () => {
    expect(() => assertOptionSelection(1, 1)).not.toThrow();
    expect(() => assertOptionSelection(0, 3)).not.toThrow();
  });

  it('rejects a negative price', () => {
    expect(() => assertPriceCents(-1)).toThrow(DomainException);
    expect(() => assertPriceCents(-1)).toThrow(
      expect.objectContaining({
        code: 'INVALID_PRICE',
        statusCode: 400,
      }),
    );
  });

  it('accepts a zero price', () => {
    expect(() => assertPriceCents(0)).not.toThrow();
  });
});
