const HUMAN_REQUEST =
  /(?:^|\b)(?:atendente|humano|humana|pessoa)(?:\b|$)/iu;
const BRL_VALUE = /R\s*\$\s*\d/iu;

export function requestsHuman(body: string): boolean {
  return HUMAN_REQUEST.test(body.normalize('NFKC'));
}

export function containsPrice(body: string): boolean {
  return BRL_VALUE.test(body.normalize('NFKC'));
}

export function validConfidence(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
