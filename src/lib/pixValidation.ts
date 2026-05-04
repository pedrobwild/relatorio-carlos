/**
 * PIX Key Validation
 *
 * Suporta os 5 tipos oficiais de chave PIX + payload Copia e Cola (BR Code/EMV).
 * - CPF: 11 dígitos
 * - CNPJ: 14 dígitos
 * - E-mail: RFC simplificado, máx 77 chars (limite Bacen)
 * - Telefone: E.164 (+55 + DDD + número), 12-13 dígitos no total
 * - Aleatória: UUID v4 (36 chars)
 * - Copia e Cola: payload EMV iniciando com "00020126" e contendo "BR.GOV.BCB.PIX"
 */

export type PixKeyType =
  | "cpf"
  | "cnpj"
  | "email"
  | "phone"
  | "random"
  | "copia_cola"
  | "unknown";

export const PIX_MAX_LENGTH = 512; // Limite para acomodar payload Copia e Cola

const onlyDigits = (s: string) => s.replace(/\D/g, "");

// ---------- Validators per type ----------

function isValidCPF(digits: string): boolean {
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  const calc = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i++)
      sum += parseInt(digits[i], 10) * (slice + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return (
    calc(9) === parseInt(digits[9], 10) && calc(10) === parseInt(digits[10], 10)
  );
}

function isValidCNPJ(digits: string): boolean {
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  const calc = (slice: number) => {
    const weights =
      slice === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += parseInt(digits[i], 10) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return (
    calc(12) === parseInt(digits[12], 10) &&
    calc(13) === parseInt(digits[13], 10)
  );
}

function isValidEmail(value: string): boolean {
  if (value.length > 77) return false; // Limite Bacen para chave PIX e-mail
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string): boolean {
  // Formato Bacen: +55 + DDD (2) + número (8 ou 9) → 12 ou 13 dígitos no total
  const digits = onlyDigits(value);
  if (!value.startsWith("+")) return false;
  if (digits.length < 12 || digits.length > 13) return false;
  if (!digits.startsWith("55")) return false;
  return true;
}

function isValidRandomKey(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isValidCopiaCola(value: string): boolean {
  // EMV/BR Code: começa com "00020126" (Payload Format Indicator + Merchant Account Info template 26)
  // e contém o GUI "BR.GOV.BCB.PIX"
  const cleaned = value.trim();
  if (cleaned.length < 50) return false;
  if (!/^0002\d{2}/.test(cleaned)) return false;
  if (!cleaned.toUpperCase().includes("BR.GOV.BCB.PIX")) return false;
  // Validação de CRC (últimos 4 chars hex após "6304")
  return /6304[0-9A-F]{4}$/i.test(cleaned);
}

// ---------- Type detection ----------

export function detectPixKeyType(rawValue: string): PixKeyType {
  const value = rawValue.trim();
  if (!value) return "unknown";

  // Copia e Cola tem prioridade (formato bem definido)
  if (/^0002\d{2}/.test(value) && value.length > 50) return "copia_cola";

  // E-mail
  if (value.includes("@")) return "email";

  // Telefone começa com +
  if (value.startsWith("+")) return "phone";

  // UUID (chave aleatória)
  if (value.includes("-") && value.length === 36) return "random";

  // Apenas dígitos → CPF ou CNPJ
  const digits = onlyDigits(value);
  if (digits === value || /^[\d.\-/\s]+$/.test(value)) {
    if (digits.length === 11) return "cpf";
    if (digits.length === 14) return "cnpj";
  }

  return "unknown";
}

// ---------- Public API ----------

export interface PixValidationResult {
  valid: boolean;
  type: PixKeyType;
  normalized: string;
  error?: string;
}

const TYPE_LABEL: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  phone: "Telefone",
  random: "Chave aleatória",
  copia_cola: "Copia e Cola",
  unknown: "Desconhecido",
};

export function getPixTypeLabel(type: PixKeyType): string {
  return TYPE_LABEL[type];
}

export function validatePixKey(rawValue: string): PixValidationResult {
  const value = (rawValue ?? "").trim();

  if (!value) {
    return {
      valid: false,
      type: "unknown",
      normalized: "",
      error: "Chave PIX é obrigatória",
    };
  }

  if (value.length > PIX_MAX_LENGTH) {
    return {
      valid: false,
      type: "unknown",
      normalized: value,
      error: `Chave muito longa (máx ${PIX_MAX_LENGTH} caracteres)`,
    };
  }

  const type = detectPixKeyType(value);

  switch (type) {
    case "cpf": {
      const digits = onlyDigits(value);
      if (!isValidCPF(digits))
        return {
          valid: false,
          type,
          normalized: digits,
          error: "CPF inválido",
        };
      return { valid: true, type, normalized: digits };
    }
    case "cnpj": {
      const digits = onlyDigits(value);
      if (!isValidCNPJ(digits))
        return {
          valid: false,
          type,
          normalized: digits,
          error: "CNPJ inválido",
        };
      return { valid: true, type, normalized: digits };
    }
    case "email": {
      const normalized = value.toLowerCase();
      if (!isValidEmail(normalized)) {
        return {
          valid: false,
          type,
          normalized,
          error: "E-mail inválido (máx 77 caracteres)",
        };
      }
      return { valid: true, type, normalized };
    }
    case "phone": {
      if (!isValidPhone(value)) {
        return {
          valid: false,
          type,
          normalized: value,
          error: "Telefone deve estar no formato +55DDDNNNNNNNNN",
        };
      }
      return { valid: true, type, normalized: "+" + onlyDigits(value) };
    }
    case "random": {
      if (!isValidRandomKey(value)) {
        return {
          valid: false,
          type,
          normalized: value,
          error: "Chave aleatória inválida (UUID esperado)",
        };
      }
      return { valid: true, type, normalized: value.toLowerCase() };
    }
    case "copia_cola": {
      if (!isValidCopiaCola(value)) {
        return {
          valid: false,
          type,
          normalized: value,
          error: "Payload Copia e Cola inválido (CRC ou estrutura incorreta)",
        };
      }
      return { valid: true, type, normalized: value };
    }
    default:
      return {
        valid: false,
        type: "unknown",
        normalized: value,
        error:
          "Formato não reconhecido. Use CPF, CNPJ, e-mail, telefone (+55…), chave aleatória ou Copia e Cola.",
      };
  }
}
