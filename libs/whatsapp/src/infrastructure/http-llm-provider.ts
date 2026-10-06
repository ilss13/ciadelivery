import { LlmInput, LlmProvider, LlmResult } from '../domain/llm-provider';
import { validConfidence } from '../domain/ai-guardrails';

const TIMEOUT_MS = 15_000;

export class HttpLlmProvider implements LlmProvider {
  constructor(private readonly url: string) {}

  async complete(input: LlmInput): Promise<LlmResult> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`LLM_HTTP_${response.status}`);
    }
    return readResult(await response.json());
  }
}

function readResult(value: unknown): LlmResult {
  if (typeof value !== 'object' || value === null) {
    throw new Error('LLM_INVALID_RESPONSE');
  }
  const record = value as Record<string, unknown>;
  const toolCalls = readToolCalls(record['toolCalls']);
  if (
    typeof record['assistantMessage'] !== 'string' ||
    (record['assistantMessage'].trim().length === 0 && toolCalls.length === 0) ||
    toolCalls.length > 10 ||
    typeof record['confidence'] !== 'number' ||
    !validConfidence(record['confidence'])
  ) {
    throw new Error('LLM_INVALID_RESPONSE');
  }
  return {
    assistantMessage: record['assistantMessage'].trim().slice(0, 4000),
    toolCalls,
    confidence: record['confidence'],
  };
}

function readToolCalls(value: unknown): LlmResult['toolCalls'] {
  if (!Array.isArray(value)) {
    throw new Error('LLM_INVALID_RESPONSE');
  }
  return value.map((call) => {
    if (typeof call !== 'object' || call === null) {
      throw new Error('LLM_INVALID_RESPONSE');
    }
    const record = call as Record<string, unknown>;
    if (
      typeof record['id'] !== 'string' ||
      record['id'].trim().length === 0 ||
      typeof record['name'] !== 'string' ||
      record['name'].trim().length === 0 ||
      !Object.prototype.hasOwnProperty.call(record, 'arguments')
    ) {
      throw new Error('LLM_INVALID_RESPONSE');
    }
    return {
      id: record['id'].trim().slice(0, 128),
      name: record['name'].trim().slice(0, 64),
      arguments: record['arguments'],
    };
  });
}
