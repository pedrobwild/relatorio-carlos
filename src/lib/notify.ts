/**
 * notify — wrapper padronizado em volta do Sonner.
 *
 * Use SEMPRE este módulo em pages e features. Evita:
 *  - durations ad-hoc (cada toast com tempo diferente)
 *  - toasts persistindo demais ou sumindo rápido
 *  - vazamento de termos técnicos em mensagens de erro
 *
 * Regras:
 *  - success: 3s
 *  - info:    4s
 *  - warning: 6s
 *  - error:   permanente (com closeButton) — usuário precisa ler
 *
 * Mensagens de erro passam por `getUserMessage` quando o input é um Error/objeto,
 * garantindo voz BWild e evitando "Row Level Security policy violated" na UI.
 */
import { toast as sonner, type ExternalToast } from "sonner";
import { getUserMessage, mapError, type UserError } from "./errorMapping";

type ToastOpts = ExternalToast;

type ErrorAction = {
  label: string;
  onClick: () => void;
};

interface ErrorOpts extends ToastOpts {
  action?: ErrorAction;
  /** Se true, NÃO passa por mapError (use quando você já formatou a mensagem). */
  raw?: boolean;
}

/**
 * Resolve uma mensagem de erro humanizada para exibir.
 * - string: usa direto
 * - Error/PostgrestError/objeto: passa por mapError
 */
function resolveErrorMessage(input: unknown, raw: boolean): string {
  if (raw && typeof input === "string") return input;
  if (typeof input === "string") return input;
  return getUserMessage(input);
}

export const notify = {
  success(message: string, opts?: ToastOpts) {
    return sonner.success(message, { duration: 3000, ...opts });
  },

  info(message: string, opts?: ToastOpts) {
    return sonner.info(message, { duration: 4000, ...opts });
  },

  warning(message: string, opts?: ToastOpts) {
    return sonner.warning(message, { duration: 6000, ...opts });
  },

  /**
   * Toast de erro padrão.
   * Aceita string OU Error/objeto — se for objeto, aplica mapError automaticamente.
   * Permanece visível até o usuário fechar (closeButton).
   */
  error(input: unknown, opts?: ErrorOpts) {
    const raw = opts?.raw ?? false;
    const message = resolveErrorMessage(input, raw);
    const { raw: _raw, action, ...rest } = opts ?? {};

    return sonner.error(message, {
      duration: Infinity,
      closeButton: true,
      ...(action
        ? { action: { label: action.label, onClick: action.onClick } }
        : {}),
      ...rest,
    });
  },

  /**
   * Toast de loading com id estável — útil para mutações longas.
   */
  loading(message: string, opts?: ToastOpts) {
    return sonner.loading(message, opts);
  },

  /**
   * Helper para promises — encadeia loading → success/error com mapError.
   */
  promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error?: string | ((error: unknown) => string);
    },
  ) {
    return sonner.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: (err) => {
        if (typeof messages.error === "function") return messages.error(err);
        if (typeof messages.error === "string") return messages.error;
        return getUserMessage(err);
      },
    });
  },

  /** Fecha um toast pelo id retornado (passthrough). */
  dismiss(id?: string | number) {
    return sonner.dismiss(id);
  },
};

/** Reexporta UserError/mapError para conveniência em features. */
export { mapError, getUserMessage };
export type { UserError };
