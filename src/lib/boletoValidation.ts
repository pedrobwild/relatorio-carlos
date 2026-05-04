/**
 * Validação da linha digitável de boleto bancário (cobrança).
 * - 47 dígitos (formato bancário tradicional)
 * - 48 dígitos (arrecadação / convênio) — validação simplificada
 *
 * Para boletos de cobrança (banco, 47 dígitos), valida:
 * 1) Comprimento correto.
 * 2) Dígitos verificadores dos campos 1, 2 e 3 (módulo 10).
 * 3) DV geral (módulo 11) que ocupa a 33ª posição da linha digitável.
 */

export interface BoletoValidationResult {
  valid: boolean;
  error?: string;
  type?: "cobranca" | "arrecadacao";
  digits?: string;
}

function mod10(field: string): number {
  // Multiplicadores 2,1,2,1,... da direita para a esquerda
  let sum = 0;
  let factor = 2;
  for (let i = field.length - 1; i >= 0; i--) {
    let n = parseInt(field[i], 10) * factor;
    if (n > 9) n = Math.floor(n / 10) + (n % 10);
    sum += n;
    factor = factor === 2 ? 1 : 2;
  }
  const remainder = sum % 10;
  const dv = (10 - remainder) % 10;
  return dv;
}

function mod11Barcode(barcode43: string): number {
  // Aplicado sobre o código de barras (43 dígitos) para gerar o DV geral
  let sum = 0;
  let factor = 2;
  for (let i = barcode43.length - 1; i >= 0; i--) {
    sum += parseInt(barcode43[i], 10) * factor;
    factor = factor === 9 ? 2 : factor + 1;
  }
  const remainder = sum % 11;
  const dv = 11 - remainder;
  if (dv === 0 || dv === 10 || dv === 11) return 1;
  return dv;
}

/**
 * Converte a linha digitável de cobrança (47 dígitos) no código de barras (44 dígitos).
 */
function lineToBarcode(line47: string): string {
  // Linha digitável: AAABC.CCCCX DDDDD.DDDDDDY EEEEE.EEEEEEZ K UUUUVVVVVVVVVV
  // - posições 1-3: banco | 4: moeda | 5-9: campo1 | 10: DV1
  // - posições 11-20: campo2 (10) | 21: DV2
  // - posições 22-31: campo3 (10) | 32: DV3
  // - posição 33: DV geral (K)
  // - posições 34-37: fator vencimento (4) | 38-47: valor (10)
  const bankAndCurrency = line47.substring(0, 4); // AAAB
  const dvGeral = line47.substring(32, 33); // K
  const factorAndValue = line47.substring(33, 47); // 14 dígitos
  const free1 = line47.substring(4, 9); // campo1 (sem DV)
  const free2 = line47.substring(10, 20); // campo2 (sem DV)
  const free3 = line47.substring(21, 31); // campo3 (sem DV)
  return `${bankAndCurrency}${dvGeral}${factorAndValue}${free1}${free2}${free3}`;
}

export function validateBoletoLine(rawValue: string): BoletoValidationResult {
  const digits = (rawValue ?? "").replace(/\D/g, "");

  if (digits.length === 0) {
    return { valid: false, error: "Informe a linha digitável do boleto." };
  }

  if (digits.length !== 47 && digits.length !== 48) {
    return {
      valid: false,
      error: `Linha digitável deve ter 47 dígitos (cobrança) ou 48 (arrecadação). Atual: ${digits.length}.`,
      digits,
    };
  }

  // Arrecadação/convênio (48 dígitos) — mantemos validação simplificada
  if (digits.length === 48) {
    return { valid: true, type: "arrecadacao", digits };
  }

  // Cobrança (47 dígitos) — valida DVs
  const field1 = digits.substring(0, 9);
  const dv1Inf = parseInt(digits[9], 10);
  const field2 = digits.substring(10, 20);
  const dv2Inf = parseInt(digits[20], 10);
  const field3 = digits.substring(21, 31);
  const dv3Inf = parseInt(digits[31], 10);
  const dvGeralInf = parseInt(digits[32], 10);

  const dv1 = mod10(field1);
  const dv2 = mod10(field2);
  const dv3 = mod10(field3);

  if (dv1 !== dv1Inf) {
    return {
      valid: false,
      error: "Dígito verificador do 1º campo inválido.",
      digits,
      type: "cobranca",
    };
  }
  if (dv2 !== dv2Inf) {
    return {
      valid: false,
      error: "Dígito verificador do 2º campo inválido.",
      digits,
      type: "cobranca",
    };
  }
  if (dv3 !== dv3Inf) {
    return {
      valid: false,
      error: "Dígito verificador do 3º campo inválido.",
      digits,
      type: "cobranca",
    };
  }

  const barcode = lineToBarcode(digits);
  const dvGeralCalc = mod11Barcode(barcode);
  if (dvGeralCalc !== dvGeralInf) {
    return {
      valid: false,
      error: "Dígito verificador geral (módulo 11) inválido.",
      digits,
      type: "cobranca",
    };
  }

  return { valid: true, type: "cobranca", digits };
}
