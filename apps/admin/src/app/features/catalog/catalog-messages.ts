import { readErrorCode } from '../../core/api-error';

const MESSAGES: Record<string, string> = {
  CATEGORY_NOT_EMPTY: 'A categoria ainda tem produtos.',
  CATEGORY_NOT_FOUND: 'Categoria não encontrada.',
  PRODUCT_NOT_FOUND: 'Produto não encontrado.',
  OPTION_GROUP_NOT_FOUND: 'Grupo de opções não encontrado.',
  OPTION_NOT_FOUND: 'Opção não encontrada.',
  INVALID_PRICE: 'Informe um preço igual ou maior que zero.',
  INVALID_OPTION_GROUP: 'A quantidade mínima não pode passar da máxima.',
  INVALID_FILE: 'Envie uma imagem JPEG, PNG ou WebP de até 2 MB.',
  FORBIDDEN: 'Você não tem permissão para alterar o cardápio.',
  VALIDATION_ERROR: 'Revise os campos e tente de novo.',
};

export function catalogErrorMessage(error: unknown): string {
  const code = readErrorCode(error);
  return MESSAGES[code] ?? code;
}
