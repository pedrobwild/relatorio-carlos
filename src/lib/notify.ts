/**
 * notify — wrapper único para Sonner com durações e padrões consistentes.
 *
 * Padrão BWild:
 *  - success: 3s, breve, não bloqueia leitura.
 *  - info:    4s, contextual.
 *  - warning: 6s, exige atenção mas não bloqueia.
 *  - error:   persistente até dispensa explícita; sempre com closeButton.
 *
 * Use SEMPRE este wrapper em pages/ e components/. Imports diretos de
 * `sonner` em pages/ são proibidos via ESLint (`no-restricted-imports`).
 *
 * Para mensagens de erro vindas de exceções, prefira:
 *   notify.error(mapError(err).userMessage)
 * para garantir que termos técnicos não vazem para o usuário.
 */
import { toast, type ExternalToast } from 'sonner';

type Msg = string;
type Opts = ExternalToast;

export const notify = {
  success: (msg: Msg, opts?: Opts) =>
    toast.success(msg, { duration: 3000, ...opts }),

  info: (msg: Msg, opts?: Opts) =>
    toast.info(msg, { duration: 4000, ...opts }),

  warning: (msg: Msg, opts?: Opts) =>
    toast.warning(msg, { duration: 6000, ...opts }),

  /**
   * Erros persistem até o usuário dispensar (closeButton sempre visível).
   * Passe `action` para oferecer "Tentar de novo" ou similar.
   */
  error: (msg: Msg, opts?: Opts) =>
    toast.error(msg, {
      duration: Infinity,
      closeButton: true,
      ...opts,
    }),

  /**
   * Mensagem neutra (sem ícone de status). Use para ações utilitárias
   * tipo "Copiado para a área de transferência".
   */
  message: (msg: Msg, opts?: Opts) =>
    toast(msg, { duration: 3000, ...opts }),

  /**
   * Promise toast — mostra loading → success/error automaticamente.
   * Útil para operações assíncronas curtas (save, delete, etc).
   */
  promise: <T>(
    promise: Promise<T>,
    messages: { loading: Msg; success: Msg | ((data: T) => Msg); error: Msg | ((err: unknown) => Msg) },
  ) =>
    toast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    }),

  dismiss: (id?: string | number) => toast.dismiss(id),
} as const;

export type Notify = typeof notify;
