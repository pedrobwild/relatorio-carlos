import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Regex de UUID v1–v5 (case-insensitive). */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifica se o valor é um UUID válido.
 *
 * Útil como guarda antes de consultas ao Supabase por `id`: evita disparar
 * queries com identificadores inválidos quando um parâmetro de rota dinâmica
 * (`:ticketId`) captura, por engano, um segmento estático como
 * `operacional` ou `analytics`.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

/**
 * Safely parse JSON with a fallback value.
 * Prevents crashes from corrupted localStorage, Supabase JSONB, or SSE data.
 */
export function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
