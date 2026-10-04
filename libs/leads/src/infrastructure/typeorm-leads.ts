import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../domain/lead';
import { LeadsRepository } from '../domain/leads-repository';
import { LeadEntity } from './lead.entity';

@Injectable()
export class TypeOrmLeads implements LeadsRepository {
  constructor(
    @InjectRepository(LeadEntity)
    private readonly leads: Repository<LeadEntity>,
  ) {}

  async insert(lead: Lead): Promise<void> {
    await this.leads.insert({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      establishmentName: lead.establishmentName,
      createdAt: lead.createdAt,
    });
  }
}
