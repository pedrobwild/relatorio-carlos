/**
 * CPF and RG validation and formatting utilities.
 *
 * Bloco 1C: instrumentado com `trackBlock1CUsage` para acompanhar volume
 * de validação em produção e detectar regressões silenciosas.
 */

import { trackBlock1CUsage } from "./block1cMonitor";

/** Apply CPF mask: 000.000.000-00 */
export function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** Validate CPF using check-digit algorithm. Accepts formatted or raw. */
export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) {
    trackBlock1CUsage("cpf-cnpj", {
      result: "invalid_length",
      length: digits.length,
    });
    return false;
  }
  // Reject known invalid sequences (all same digit)
  if (/^(\d)\1{10}$/.test(digits)) {
    trackBlock1CUsage("cpf-cnpj", { result: "invalid_sequence" });
    return false;
  }

  // First check digit — explicit radix 10 to avoid octal interpretation of leading-zero digits.
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i], 10) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9], 10)) {
    trackBlock1CUsage("cpf-cnpj", { result: "invalid_check_digit_1" });
    return false;
  }

  // Second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[10], 10)) {
    trackBlock1CUsage("cpf-cnpj", { result: "invalid_check_digit_2" });
    return false;
  }

  trackBlock1CUsage("cpf-cnpj", { result: "valid" });
  return true;
}

/** Apply RG mask: 00.000.000-X (SP-style, flexible for other states) */
export function formatRg(value: string): string {
  // Allow digits and trailing letter (X for some states)
  const cleaned = value
    .replace(/[^\dXx]/g, "")
    .slice(0, 9)
    .toUpperCase();
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 5) return `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
  if (cleaned.length <= 8)
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5)}`;
  return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}-${cleaned.slice(8)}`;
}

/** Basic RG validation: 5-9 alphanumeric characters when stripped */
export function isValidRg(rg: string): boolean {
  const cleaned = rg.replace(/[^\dXx]/g, "");
  return cleaned.length >= 5 && cleaned.length <= 9;
}
