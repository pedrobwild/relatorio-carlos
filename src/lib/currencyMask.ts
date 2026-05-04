/**
 * Currency mask utilities for BRL (R$) formatting.
 * Stores value in cents internally, displays formatted.
 */

/**
 * Format a numeric string (raw digits or decimal) into BRL display format.
 * E.g. "150000" → "1.500,00" (from cents)
 * E.g. "1500.00" → "1.500,00" (from decimal)
 */
export function formatCurrencyBRL(value: string): string {
  // Remove tudo exceto dígitos
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  // Converte para centavos
  const cents = parseInt(digits, 10);
  const reais = cents / 100;

  return reais.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parse a BRL formatted string back to a numeric string (decimal).
 * E.g. "1.500,00" → "1500.00"
 * E.g. "" → ""
 */
export function parseCurrencyBRL(formatted: string): string {
  if (!formatted) return "";
  // Remove dots (thousands separator), replace comma with dot (decimal)
  const cleaned = formatted.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "";
  return num.toString();
}

/**
 * Handle a currency input change event.
 * Returns the formatted display string and the raw numeric string.
 */
export function handleCurrencyInput(rawInput: string): {
  display: string;
  value: string;
} {
  const display = formatCurrencyBRL(rawInput);
  const value = parseCurrencyBRL(display);
  return { display, value };
}
