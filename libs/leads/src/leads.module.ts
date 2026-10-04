import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateLead } from './application/create-lead';
import { LEAD_RATE_LIMIT, LeadRateLimit } from './domain/lead-rate-limit';
import { LEADS, LeadsRepository } from './domain/leads-repository';
import { LeadEntity } from './infrastructure/lead.entity';
import { RedisLeadRateLimit } from './infrastructure/redis-lead-rate-limit';
import { TypeOrmLeads } from './infrastructure/typeorm-leads';
import { PublicLeadsController } from './presentation/public-leads.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LeadEntity])],
  controllers: [PublicLeadsController],
  providers: [
    TypeOrmLeads,
    { provide: LEADS, useExisting: TypeOrmLeads },
    RedisLeadRateLimit,
    { provide: LEAD_RATE_LIMIT, useExisting: RedisLeadRateLimit },
    {
      provide: CreateLead,
      useFactory: (leads: LeadsRepository, rateLimit: LeadRateLimit) =>
        new CreateLead(leads, rateLimit),
      inject: [LEADS, LEAD_RATE_LIMIT],
    },
  ],
})
export class LeadsModule {}
