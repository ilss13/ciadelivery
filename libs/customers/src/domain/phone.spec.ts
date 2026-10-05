import { normalizeBrazilPhone } from './phone';

describe('normalizeBrazilPhone', () => {
  it('treats formatted, local and international numbers as the same phone', () => {
    const formatted = normalizeBrazilPhone('(11) 98888-7777');
    const local = normalizeBrazilPhone('11988887777');
    const international = normalizeBrazilPhone('5511988887777');

    expect(formatted).toBe('5511988887777');
    expect(local).toBe(formatted);
    expect(international).toBe(formatted);
  });

  it('prefixes a 10-digit landline with the Brazil country code', () => {
    expect(normalizeBrazilPhone('(11) 3333-4444')).toBe('551133334444');
    expect(normalizeBrazilPhone('1133334444')).toBe('551133334444');
    expect(normalizeBrazilPhone('551133334444')).toBe('551133334444');
  });

  it('rejects a number that cannot be a Brazilian phone', () => {
    expect(() => normalizeBrazilPhone('123')).toThrow(
      expect.objectContaining({
        code: 'INVALID_PHONE',
        statusCode: 400,
      }),
    );
  });
});
