import { resolveRequestId } from '@ciadelivery/shared';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('resolveRequestId', () => {
  it('keeps a safe incoming request id', () => {
    expect(resolveRequestId('abc-123')).toBe('abc-123');
  });

  it('uses the first value when the header is repeated', () => {
    expect(resolveRequestId(['first-id', 'second-id'])).toBe('first-id');
  });

  it('generates a uuid when the header is missing or unsafe', () => {
    expect(resolveRequestId(undefined)).toMatch(UUID_PATTERN);
    expect(resolveRequestId('bad id\ninjected')).toMatch(UUID_PATTERN);
    expect(resolveRequestId('')).toMatch(UUID_PATTERN);
  });
});
