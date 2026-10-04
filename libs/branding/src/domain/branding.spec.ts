import { assertBusinessHours, demoWeek } from './business-hours';
import { normalizeBranding } from './branding';

function week(opensAt: string, closesAt: string, closed = false) {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    opensAt,
    closesAt,
    closed,
  }));
}

describe('assertBusinessHours', () => {
  it('accepts a shift that crosses midnight', () => {
    const hours = assertBusinessHours(
      week('22:00', '02:00').map((day) =>
        day.weekday === 1 ? { ...day, closed: true, opensAt: '00:00', closesAt: '00:00' } : day,
      ),
    );

    expect(hours.find((day) => day.weekday === 0)).toMatchObject({
      opensAt: '22:00:00',
      closesAt: '02:00:00',
      closed: false,
    });
  });

  it('rejects an open day that starts and ends at the same time', () => {
    expect(() => assertBusinessHours(week('18:00:00', '18:00:00'))).toThrow(
      expect.objectContaining({
        code: 'INVALID_BUSINESS_HOURS',
        statusCode: 400,
      }),
    );
  });

  it('rejects a duplicated weekday', () => {
    const days = week('18:00', '23:00');
    days[6] = { ...days[0], weekday: 0 };
    expect(() => assertBusinessHours(days)).toThrow(
      expect.objectContaining({ code: 'INVALID_BUSINESS_HOURS' }),
    );
  });

  it('builds the demo week from Tuesday through Sunday', () => {
    const hours = demoWeek();
    expect(hours.find((day) => day.weekday === 1)?.closed).toBe(true);
    expect(hours.find((day) => day.weekday === 2)).toMatchObject({
      opensAt: '18:00:00',
      closesAt: '23:00:00',
      closed: false,
    });
    expect(hours.find((day) => day.weekday === 0)?.closed).toBe(false);
  });
});

describe('normalizeBranding', () => {
  it('rejects an invalid color', () => {
    expect(() =>
      normalizeBranding({
        displayName: 'Loja',
        logoUrl: null,
        faviconUrl: null,
        bannerUrl: null,
        primaryColor: 'red',
        secondaryColor: '#FFFFFF',
        accentColor: '#000000',
        fontFamily: null,
        seoTitle: 'Loja',
        seoDescription: '',
        instagramUrl: null,
        facebookUrl: null,
        websiteUrl: null,
        contactEmail: null,
        whatsappPhone: null,
      }),
    ).toThrow(
      expect.objectContaining({ code: 'INVALID_COLOR', statusCode: 400 }),
    );
  });

  it('stores colors in uppercase', () => {
    const branding = normalizeBranding({
      displayName: 'Loja',
      logoUrl: null,
      faviconUrl: null,
      bannerUrl: null,
      primaryColor: '#c0392b',
      secondaryColor: '#ffffff',
      accentColor: '#111111',
      fontFamily: null,
      seoTitle: 'Loja',
      seoDescription: '',
      instagramUrl: null,
      facebookUrl: null,
      websiteUrl: null,
      contactEmail: null,
      whatsappPhone: null,
    });

    expect(branding.primaryColor).toBe('#C0392B');
  });
});
