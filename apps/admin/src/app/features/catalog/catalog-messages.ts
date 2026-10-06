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
  CSV_REQUIRED: 'Envie um arquivo CSV UTF-8.',
  CSV_INVALID_HEADER: 'O cabeçalho do CSV não corresponde ao modelo.',
  CSV_TOO_MANY_ROWS: 'O arquivo pode ter no máximo 500 linhas.',
  CSV_INVALID_COLUMNS: 'A linha deve ter todas as 10 colunas do modelo.',
  CSV_MALFORMED: 'A linha tem aspas ou colunas inválidas.',
  CSV_EMPTY: 'O arquivo não contém produtos.',
  CATEGORY_REQUIRED: 'Informe a categoria.',
  PRODUCT_REQUIRED: 'Informe o produto.',
  OPTION_GROUP_REQUIRED: 'Informe o grupo antes dos dados da opção.',
  OPTION_REQUIRED: 'Informe o nome da opção.',
  INVALID_OPTION_PRICE: 'Informe um preço válido para a opção.',
  PRODUCT_CONFLICT: 'As linhas repetidas do produto têm dados diferentes.',
  OPTION_GROUP_CONFLICT: 'As linhas do grupo têm mínimo ou máximo diferentes.',
  OPTION_CONFLICT: 'As linhas repetidas da opção têm preços diferentes.',
  CATALOG_IMPORT_INVALID: 'Revise os erros do arquivo.',
};

export function catalogErrorMessage(error: unknown): string {
  const code = readErrorCode(error);
  return MESSAGES[code] ?? code;
}

export function catalogImportErrorMessage(code: string): string {
  return MESSAGES[code] ?? 'Revise esta linha.';
}
