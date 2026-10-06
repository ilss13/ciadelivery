export type AiTurnOutcome = 'REPLIED' | 'HANDOFF' | 'BLOCKED';

export interface AiTurnRecord {
  id: string;
  tenantId: string;
  conversationId: string;
  confidence: number;
  outcome: AiTurnOutcome;
  promptHash: string;
  createdAt: Date;
}

export interface AiTurns {
  countSince(
    tenantId: string,
    conversationId: string,
    since: Date,
  ): Promise<number>;
  record(turn: AiTurnRecord): Promise<void>;
}

export const AI_TURNS = Symbol('AI_TURNS');

export interface AiStoreSettings {
  aiEnabled: boolean;
  aiAutoReply: boolean;
}

export interface AiConfigurations {
  find(tenantId: string, storeId: string): Promise<AiStoreSettings | null>;
  update(
    tenantId: string,
    storeId: string,
    settings: AiStoreSettings,
  ): Promise<AiStoreSettings | null>;
}

export const AI_CONFIGURATIONS = Symbol('AI_CONFIGURATIONS');
