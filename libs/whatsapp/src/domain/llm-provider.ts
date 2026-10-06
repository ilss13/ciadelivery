import {
  ConversationToolCall,
  ConversationToolResult,
  LlmToolDefinition,
} from './conversation-tools';

export interface LlmMessage {
  role: 'customer' | 'assistant';
  content: string;
}

export interface LlmInput {
  history: LlmMessage[];
  tools: readonly LlmToolDefinition[];
  toolResults: readonly ConversationToolResult[];
}

export interface LlmResult {
  assistantMessage: string;
  toolCalls: ConversationToolCall[];
  confidence: number;
}

export interface LlmProvider {
  complete(input: LlmInput): Promise<LlmResult>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export class ScriptedLlmProvider implements LlmProvider {
  readonly inputs: LlmInput[] = [];

  constructor(private readonly results: Array<LlmResult | Error>) {}

  async complete(input: LlmInput): Promise<LlmResult> {
    this.inputs.push(input);
    const result = this.results.shift();
    if (result === undefined) {
      throw new Error('No scripted LLM response');
    }
    if (result instanceof Error) {
      throw result;
    }
    return result;
  }
}
