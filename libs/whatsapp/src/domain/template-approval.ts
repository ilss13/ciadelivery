export class TemplateNotApprovedError extends Error {
  readonly code = 'TEMPLATE_NOT_APPROVED';

  constructor() {
    super('TEMPLATE_NOT_APPROVED');
    this.name = 'TemplateNotApprovedError';
  }
}

const TEMPLATE_ERROR_CODES = new Set([
  132000, 132001, 132005, 132007, 132012, 132015, 132016,
]);

export function isTemplateNotApprovedPayload(payload: unknown): boolean {
  if (payload === null || typeof payload !== 'object') {
    return false;
  }
  const error = (payload as { error?: unknown }).error;
  if (error === null || typeof error !== 'object') {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'number' && TEMPLATE_ERROR_CODES.has(code);
}
