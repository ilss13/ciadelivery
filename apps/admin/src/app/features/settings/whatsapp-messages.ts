import { readErrorCode } from '../../core/api-error';

const MESSAGES: Record<string, string> = {
  WHATSAPP_NUMBER_REJECTED:
    'A Meta não aceitou esse número. Confira o ID e o token da conta.',
  WHATSAPP_PHONE_IN_USE: 'Esse número já está conectado em outra loja.',
  WHATSAPP_ENCRYPTION_UNAVAILABLE:
    'A criptografia de credenciais não está configurada.',
  WHATSAPP_PROVIDER_UNAVAILABLE:
    'Não foi possível falar com a API oficial agora.',
  FORBIDDEN: 'Você não tem permissão para operar o WhatsApp.',
  VALIDATION_ERROR: 'Revise os campos e tente de novo.',
  WHATSAPP_TEMPLATE_NOT_FOUND:
    'Conecte o WhatsApp antes de ligar ou desligar um aviso.',
  WHATSAPP_TEMPLATE_UNKNOWN: 'Esse aviso de pedido não existe.',
  TEMPLATE_NOT_APPROVED: 'O template ainda não foi aprovado na Meta.',
  NO_CONNECTION: 'A loja não estava conectada.',
  TEMPLATE_DISABLED: 'O aviso estava desligado.',
};

export function whatsappCodeMessage(code: string): string {
  return MESSAGES[code] ?? code;
}

export function whatsappErrorMessage(error: unknown): string {
  return whatsappCodeMessage(readErrorCode(error));
}
