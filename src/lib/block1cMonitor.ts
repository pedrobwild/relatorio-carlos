/**
 * Block 1C — Production Monitoring
 *
 * Centralized helpers para acompanhar a resolução dos bugs do bloco 1C
 * (parseInt sem radix, leaks de setTimeout, validações silenciosas).
 *
 * Estratégia:
 * - safeParseInt: sempre força radix 10 e reporta entradas suspeitas (NaN)
 *   via captureMessage, sem quebrar o fluxo (retorna fallback).
 * - trackBlock1C: emite eventos de uso para correlacionar volume de uso
 *   com regressões. Métricas vão para console (DEV) e errorBuffer.
 *
 * Como consultar em produção:
 * 1) Console: filtrar por "[1C]"
 * 2) errorBuffer: getErrorBuffer().filter(r => r.context.feature === 'diagnostics' && r.context.block === '1C')
 * 3) Auditoria (quando persistido via telemetry.track com persist=true)
 */

import { captureMessage } from "./errorMonitoring";
import { logInfo } from "./errorLogger";

export type Block1CArea =
  | "cpf-cnpj"
  | "parcelas"
  | "duracao"
  | "peso-atividade"
  | "lead-time"
  | "sort-order"
  | "timer-cleanup";

interface SafeParseIntOptions {
  /** Identifica a origem da chamada para correlação em logs. */
  area: Block1CArea;
  /** Componente/contexto adicional. */
  context?: string;
  /** Valor a usar quando entrada for inválida (default: 0). */
  fallback?: number;
  /** Se true, valores menores que 0 também disparam alerta. */
  rejectNegative?: boolean;
}

/**
 * parseInt seguro com radix 10 e telemetria de falhas silenciosas.
 *
 * Retorna `fallback` (default 0) quando a entrada não é parseável.
 * Loga via captureMessage para alimentar o errorBuffer e o console.
 */
export function safeParseInt(
  raw: string | number | null | undefined,
  options: SafeParseIntOptions,
): number {
  const fallback = options.fallback ?? 0;

  if (raw === null || raw === undefined || raw === "") {
    return fallback;
  }

  const asString = typeof raw === "string" ? raw.trim() : String(raw);
  const parsed = parseInt(asString, 10);

  if (Number.isNaN(parsed)) {
    captureMessage(`[1C] parseInt retornou NaN em ${options.area}`, "warning", {
      feature: "diagnostics",
      action: "block1c_parseint_nan",
      block: "1C",
      area: options.area,
      context: options.context,
      rawValue: asString.slice(0, 50), // limita para evitar payload grande
    });
    return fallback;
  }

  if (options.rejectNegative && parsed < 0) {
    captureMessage(
      `[1C] parseInt retornou valor negativo em ${options.area}`,
      "warning",
      {
        feature: "diagnostics",
        action: "block1c_parseint_negative",
        block: "1C",
        area: options.area,
        context: options.context,
        parsed,
      },
    );
    return fallback;
  }

  return parsed;
}

/**
 * Registra uso de um ponto crítico do bloco 1C para métricas agregadas.
 *
 * Não persiste — apenas console + buffer. Use `track()` de telemetry.ts
 * quando precisar persistir em `auditoria`.
 */
export function trackBlock1CUsage(
  area: Block1CArea,
  payload: Record<string, unknown> = {},
): void {
  logInfo(`[1C] uso em ${area}`, {
    component: "block1c-monitor",
    block: "1C",
    area,
    ...payload,
  });
}

/**
 * Helper para envolver setTimeout com cleanup obrigatório e telemetria
 * caso o callback dispare após desmontar (detecta leaks residuais).
 */
export function createMonitoredTimeout(
  callback: () => void,
  delayMs: number,
  area: Block1CArea,
): () => void {
  let cancelled = false;
  const handle = setTimeout(() => {
    if (cancelled) {
      // Não deveria acontecer — se acontecer, é leak.
      captureMessage(
        `[1C] setTimeout disparou após cancelamento em ${area}`,
        "warning",
        {
          feature: "diagnostics",
          action: "block1c_timer_after_cancel",
          block: "1C",
          area,
        },
      );
      return;
    }
    try {
      callback();
    } catch (err) {
      captureMessage(
        `[1C] callback de setTimeout lançou erro em ${area}`,
        "error",
        {
          feature: "diagnostics",
          action: "block1c_timer_callback_error",
          block: "1C",
          area,
          error: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }, delayMs);

  return () => {
    cancelled = true;
    clearTimeout(handle);
  };
}
