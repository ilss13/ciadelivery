import { randomUUID } from 'node:crypto';
import { JsonLogger } from '@ciadelivery/shared';
import { LeadDraft } from '../domain/lead';
import { LeadRateLimit } from '../domain/lead-rate-limit';
import { LeadsRepository } from '../domain/leads-repository';

export class CreateLead {
  private readonly logger = new JsonLogger();

  constructor(
    private readonly leads: LeadsRepository,
    private readonly rateLimit: LeadRateLimit,
  ) {}

  async execute(draft: LeadDraft, ip: string): Promise<{ id: string }> {
    await this.rateLimit.consume(ip);
    const id = randomUUID();
    await this.leads.insert({
      id,
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
      establishmentName: draft.establishmentName,
      createdAt: new Date(),
    });
    this.logger.log(`Lead created ${id}`, 'CreateLead');
    return { id };
  }
}
