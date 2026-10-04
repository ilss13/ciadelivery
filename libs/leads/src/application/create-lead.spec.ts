import { DomainException } from '@ciadelivery/shared';
import { Lead } from '../domain/lead';
import { LeadRateLimit } from '../domain/lead-rate-limit';
import { LeadsRepository } from '../domain/leads-repository';
import { CreateLead } from './create-lead';

const draft = {
  name: 'Ana',
  email: 'ana@example.com',
  phone: '11999999999',
  establishmentName: 'Padaria da Ana',
};

describe('CreateLead', () => {
  it('stores the lead without a tenant id', async () => {
    const saved: Lead[] = [];
    const leads: LeadsRepository = {
      insert: async (lead) => {
        saved.push(lead);
      },
    };
    const rateLimit: LeadRateLimit = { consume: async () => undefined };
    const created = await new CreateLead(leads, rateLimit).execute(
      draft,
      '127.0.0.1',
    );

    expect(created.id).toBe(saved[0]?.id);
    expect(saved[0]).not.toHaveProperty('tenantId');
    expect(saved[0]?.establishmentName).toBe('Padaria da Ana');
  });

  it('does not store a lead when the rate limit is exhausted', async () => {
    const leads: LeadsRepository = { insert: async () => undefined };
    const insert = jest.spyOn(leads, 'insert');
    const rateLimit: LeadRateLimit = {
      consume: async () => {
        throw new DomainException('RATE_LIMITED', 'Too many requests', 429);
      },
    };

    await expect(
      new CreateLead(leads, rateLimit).execute(draft, '127.0.0.1'),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(insert).not.toHaveBeenCalled();
  });
});
