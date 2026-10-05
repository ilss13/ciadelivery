import {
  canonicalContactPhone,
  contactLabel,
  modeAfterInbound,
  orderNumbersInText,
} from './conversation';

describe('conversation rules', () => {
  it('reads order numbers written as #123 and ignores the rest of the text', () => {
    expect(orderNumbersInText('oi #12 e também #12, #9999999999 #7')).toEqual([
      12, 7,
    ]);
    expect(orderNumbersInText('sem numero')).toEqual([]);
  });

  it('opens or reopens in HUMAN and leaves BOT and PAUSED alone', () => {
    expect(modeAfterInbound(null)).toBe('HUMAN');
    expect(modeAfterInbound('CLOSED')).toBe('HUMAN');
    expect(modeAfterInbound('HUMAN')).toBe('HUMAN');
    expect(modeAfterInbound('BOT')).toBe('BOT');
    expect(modeAfterInbound('PAUSED')).toBe('PAUSED');
  });

  it('keeps a dialable phone and a short contact name', () => {
    expect(canonicalContactPhone('+55 (11) 99999-9999')).toBe('5511999999999');
    expect(canonicalContactPhone('123')).toBeNull();
    expect(contactLabel('  Ana   Souza  ')).toBe('Ana Souza');
    expect(contactLabel('   ')).toBeNull();
  });
});
