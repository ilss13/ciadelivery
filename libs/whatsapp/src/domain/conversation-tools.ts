import { AddressInput } from '@ciadelivery/shared';

export const CONVERSATION_TOOL_NAMES = [
  'search_catalog',
  'get_product',
  'resolve_options',
  'quote_delivery',
  'preview_order',
] as const;

export type ConversationToolName = (typeof CONVERSATION_TOOL_NAMES)[number];

export interface LlmToolDefinition {
  name: ConversationToolName;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ConversationToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface ConversationToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
}

export interface PreviewToolResult {
  previewToken: string;
  customerName: string;
  items: Array<{
    name: string;
    quantity: number;
    options: string[];
  }>;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
}

export interface ConversationToolContext {
  tenantId: string;
  storeId: string;
  conversationId: string;
  contactPhone: string;
}

export interface ConversationTools {
  execute(
    context: ConversationToolContext,
    call: ConversationToolCall,
  ): Promise<unknown>;
}

export const CONVERSATION_TOOLS = Symbol('CONVERSATION_TOOLS');

const addressSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['line', 'number', 'district', 'city', 'state', 'postalCode'],
  properties: {
    line: { type: 'string', maxLength: 160 },
    number: { type: 'string', maxLength: 20 },
    district: { type: 'string', maxLength: 80 },
    city: { type: 'string', maxLength: 80 },
    state: { type: 'string', maxLength: 40 },
    postalCode: { type: 'string', maxLength: 20 },
    complement: { type: ['string', 'null'], maxLength: 160 },
  },
} satisfies Record<string, unknown>;

export const conversationToolDefinitions: readonly LlmToolDefinition[] = [
  {
    name: 'search_catalog',
    description: 'Busca até oito produtos ativos da loja pelo nome.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['query'],
      properties: { query: { type: 'string', minLength: 1, maxLength: 80 } },
    },
  },
  {
    name: 'get_product',
    description: 'Obtém um produto da loja e suas opções disponíveis.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['productId'],
      properties: { productId: { type: 'string', format: 'uuid' } },
    },
  },
  {
    name: 'resolve_options',
    description: 'Valida as opções selecionadas para um produto.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['productId', 'optionIds'],
      properties: {
        productId: { type: 'string', format: 'uuid' },
        optionIds: {
          type: 'array',
          maxItems: 50,
          items: { type: 'string', format: 'uuid' },
        },
      },
    },
  },
  {
    name: 'quote_delivery',
    description: 'Calcula disponibilidade e taxa de entrega para um endereço.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['address'],
      properties: { address: addressSchema },
    },
  },
  {
    name: 'preview_order',
    description:
      'Valida o carrinho e cria uma prévia temporária, sem criar o pedido.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['items', 'fulfillment', 'phone', 'name'],
      properties: {
        items: {
          type: 'array',
          minItems: 1,
          maxItems: 50,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['productId', 'quantity', 'optionIds'],
            properties: {
              productId: { type: 'string', format: 'uuid' },
              quantity: { type: 'integer', minimum: 1, maximum: 99 },
              optionIds: {
                type: 'array',
                maxItems: 50,
                items: { type: 'string', format: 'uuid' },
              },
              notes: { type: ['string', 'null'], maxLength: 280 },
            },
          },
        },
        fulfillment: { type: 'string', enum: ['DELIVERY', 'PICKUP'] },
        address: { anyOf: [addressSchema, { type: 'null' }] },
        phone: { type: 'string', minLength: 8, maxLength: 20 },
        name: { type: 'string', minLength: 1, maxLength: 160 },
      },
    },
  },
] as const;

export function isAddressInput(value: unknown): value is AddressInput {
  if (!isRecord(value)) {
    return false;
  }
  return ['line', 'number', 'district', 'city', 'state', 'postalCode'].every(
    (key) =>
      typeof value[key] === 'string' &&
      value[key].trim().length > 0 &&
      value[key].length <= (key === 'line' ? 160 : 80),
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
