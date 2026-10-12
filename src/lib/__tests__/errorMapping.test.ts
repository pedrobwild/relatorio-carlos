import { describe, it, expect } from "vitest";
import {
  mapError,
  getUserMessage,
  isAuthError,
  isForbiddenError,
  isNetworkError,
} from "../errorMapping";

describe("mapError", () => {
  describe("forbidden / RLS", () => {
    it('detects "row level security" message', () => {
      const result = mapError({
        message:
          'new row violates row-level security policy for table "documents"',
      });
      expect(result.kind).toBe("forbidden");
      expect(result.userMessage).not.toMatch(/RLS|policy|row[- ]level/i);
      expect(result.userMessage).toMatch(/permissão/i);
    });

    it('detects bare "RLS" mention', () => {
      expect(mapError("RLS denied").kind).toBe("forbidden");
    });

    it('detects "permission denied"', () => {
      expect(
        mapError({ message: "permission denied for table foo" }).kind,
      ).toBe("forbidden");
    });

    it("detects HTTP 403 status", () => {
      expect(mapError({ status: 403 }).kind).toBe("forbidden");
    });
  });

  describe("auth", () => {
    it("detects JWT expired", () => {
      const r = mapError({ message: "JWT expired" });
      expect(r.kind).toBe("auth");
      expect(r.suggestedAction).toBe("redirect_auth");
      expect(r.userMessage).not.toMatch(/JWT/i);
      expect(r.userMessage).toMatch(/sessão expirou/i);
    });

    it('detects "session expired" wording', () => {
      expect(
        mapError({ message: "Session expired, please re-authenticate" }).kind,
      ).toBe("auth");
    });

    it("detects HTTP 401", () => {
      expect(mapError({ status: 401 }).kind).toBe("auth");
    });

    it('detects "invalid_token"', () => {
      expect(mapError({ message: "invalid_token" }).kind).toBe("auth");
    });
  });

  describe("server / 5xx", () => {
    it("detects HTTP 500", () => {
      expect(mapError({ status: 500 }).kind).toBe("server");
    });

    it('detects "internal server error"', () => {
      expect(mapError({ message: "Internal Server Error" }).kind).toBe(
        "server",
      );
    });

    it('detects "service unavailable"', () => {
      expect(mapError({ message: "Service Unavailable" }).kind).toBe("server");
    });

    it('does not leak "Postgres" or "PGRST" to user message', () => {
      const r = mapError({ message: "PGRST500: postgres internal" });
      expect(r.userMessage).not.toMatch(/postgres|pgrst/i);
    });
  });

  describe("network / offline", () => {
    it('detects "Failed to fetch"', () => {
      const r = mapError({ message: "Failed to fetch" });
      expect(r.kind).toBe("network");
      expect(r.suggestedAction).toBe("retry");
    });

    it('detects "timeout"', () => {
      expect(mapError({ message: "Request timeout" }).kind).toBe("network");
    });

    it('detects "NetworkError"', () => {
      expect(
        mapError({ message: "NetworkError when attempting to fetch resource." })
          .kind,
      ).toBe("network");
    });

    it('detects "offline" keyword', () => {
      expect(mapError({ message: "browser is offline" }).kind).toBe("network");
    });
  });

  describe("conflict / validation", () => {
    it("detects unique constraint (23505)", () => {
      const r = mapError({
        code: "23505",
        message: "duplicate key value violates unique constraint",
      });
      expect(r.kind).toBe("conflict");
      expect(r.userMessage).toMatch(/já existe/i);
    });

    it("detects foreign key (23503)", () => {
      expect(
        mapError({ code: "23503", message: "foreign key violation" }).kind,
      ).toBe("conflict");
    });

    it("detects not_null_violation (23502)", () => {
      expect(
        mapError({ code: "23502", message: "null value in column" }).kind,
      ).toBe("validation");
    });

    it("detects check_violation (23514)", () => {
      expect(mapError({ code: "23514" }).kind).toBe("validation");
    });

    it("regra de negócio do banco (RAISE ... 23514 em português) chega como foi escrita", () => {
      const r = mapError({ code: "23514", message: "Ainda há 2 dia(s) sem confirmação nesta semana", details: null, hint: null });
      expect(r.kind).toBe("validation");
      expect(r.userMessage).toBe("Ainda há 2 dia(s) sem confirmação nesta semana");
    });

    it("23514 nativo do Postgres continua com a mensagem genérica (nada de nome de constraint na tela)", () => {
      const r = mapError({
        code: "23514",
        message: 'new row for relation "ops_week_closings" violates check constraint "ops_week_closings_monday_chk"',
      });
      expect(r.kind).toBe("validation");
      expect(r.userMessage).not.toMatch(/constraint|relation|ops_week/);
    });

    it("fase de projeto: as recusas do banco chegam em português como foram escritas", () => {
      for (const message of [
        "A data de conclusão não pode ser no futuro",
        "Esta obra já saiu da fase de projeto: as etapas de projeto não podem mais ser alteradas",
        "Informe em que etapa a obra está",
      ]) {
        const r = mapError({ code: "23514", message, details: null, hint: null });
        expect(r.kind).toBe("validation");
        expect(r.userMessage).toBe(message);
      }
    });

    it("texto de regra só vale para os nossos códigos: os demais não vazam mensagem do servidor", () => {
      expect(mapError({ code: "42P01", message: "Mensagem qualquer do servidor" }).userMessage).not.toBe(
        "Mensagem qualquer do servidor",
      );
    });
  });

  describe("recusa de permissão das nossas RPCs (42501)", () => {
    it("mensagem em português da RPC chega como foi escrita, como 'forbidden'", () => {
      for (const message of ["Sem permissão para alterar a fase de projeto", "Sem acesso a esta obra"]) {
        const r = mapError({ code: "42501", message, details: null, hint: null });
        expect(r.kind).toBe("forbidden");
        expect(r.userMessage).toBe(message);
        expect(r.suggestedAction).toBe("contact_support");
      }
    });

    it("mesma coisa depois de passar pelo repositório (erro clonado, com userError)", () => {
      const original = { code: "42501", message: "Sem acesso a esta obra", details: null, hint: null };
      const cloned = Object.assign({}, original, { userError: mapError(original) });
      expect(mapError(cloned).userMessage).toBe("Sem acesso a esta obra");
    });

    it("42501 nativo do Postgres continua genérico (nada de nome de tabela ou policy na tela)", () => {
      const nativos = [
        "permission denied for table project_phase_steps",
        "permission denied for function move_project_to_phase_step",
        'new row violates row-level security policy for table "project_phase_steps"',
        "must be owner of table projects",
      ];
      for (const message of nativos) {
        const r = mapError({ code: "42501", message });
        expect(r.kind).toBe("forbidden");
        expect(r.userMessage).not.toMatch(/project_phase_steps|move_project|policy|owner|table/i);
      }
    });

    it("42501 sem texto ou com texto longo demais não vira mensagem de tela", () => {
      expect(mapError({ code: "42501", message: "" }).userMessage).not.toBe("");
      const longo = "x".repeat(201);
      expect(mapError({ code: "42501", message: longo }).userMessage).not.toBe(longo);
    });
  });

  describe("não encontrado das nossas RPCs (P0002)", () => {
    it("'Obra não encontrada' vira a mensagem padrão de item não encontrado", () => {
      const r = mapError({ code: "P0002", message: "Obra não encontrada", details: null, hint: null });
      expect(r.kind).toBe("not_found");
      expect(r.userMessage).toBe("Não encontramos esse item. Talvez tenha sido movido ou removido.");
    });
  });

  describe("not_found / storage", () => {
    it("detects HTTP 404", () => {
      expect(mapError({ status: 404 }).kind).toBe("not_found");
    });

    it('detects "object not found"', () => {
      expect(mapError({ message: "Object not found" }).kind).toBe("not_found");
    });

    it("detects HTTP 413", () => {
      expect(mapError({ status: 413 }).kind).toBe("storage");
    });

    it('detects "payload too large"', () => {
      expect(mapError({ message: "Payload too large" }).kind).toBe("storage");
    });
  });

  describe("rate_limit", () => {
    it("detects 429", () => {
      expect(mapError({ status: 429 }).kind).toBe("rate_limit");
    });

    it('detects "too many requests"', () => {
      expect(mapError({ message: "Too Many Requests" }).kind).toBe(
        "rate_limit",
      );
    });
  });

  describe("unknown / fallback", () => {
    it('returns "unknown" for unrecognized errors', () => {
      const r = mapError({ message: "something completely unexpected" });
      expect(r.kind).toBe("unknown");
      expect(r.userMessage).toMatch(/algo não saiu/i);
    });

    it("handles null/undefined gracefully", () => {
      expect(mapError(null).kind).toBe("unknown");
      expect(mapError(undefined).kind).toBe("unknown");
    });

    it("handles plain string input", () => {
      expect(mapError("JWT expired").kind).toBe("auth");
    });

    it("handles Error instances", () => {
      const e = new Error("Failed to fetch");
      expect(mapError(e).kind).toBe("network");
    });
  });

  describe("user-facing messages — no technical leakage", () => {
    const banned = /\b(RLS|JWT|Postgres|PGRST|policy|row[- ]level)\b/i;

    const cases: Array<[string, unknown]> = [
      ["rls", { message: "new row violates row-level security policy" }],
      ["jwt", { message: "JWT expired" }],
      ["postgres", { message: "postgres connection failed" }],
      ["pgrst", { message: "PGRST116 no rows" }],
      ["policy", { message: "policy violation" }],
      ["500", { status: 500, message: "Internal Server Error" }],
      ["network", { message: "Failed to fetch" }],
      ["unique", { code: "23505", message: "duplicate key" }],
    ];

    it.each(cases)(
      "does not leak technical jargon for case: %s",
      (_, error) => {
        const message = getUserMessage(error);
        expect(message).not.toMatch(banned);
      },
    );
  });

  describe("preserves technical details", () => {
    it("keeps original message in technicalDetails", () => {
      const r = mapError({ message: "JWT expired at 2026-01-01" });
      expect(r.technicalDetails).toContain("JWT expired");
    });
  });

  describe("code preservation", () => {
    it("preserves Postgres error code", () => {
      const r = mapError({ code: "23505", message: "duplicate key" });
      expect(r.code).toBe("23505");
    });
  });

  describe("helper sentinels", () => {
    it("isAuthError", () => {
      expect(isAuthError({ message: "JWT expired" })).toBe(true);
      expect(isAuthError({ message: "Failed to fetch" })).toBe(false);
    });

    it("isForbiddenError", () => {
      expect(
        isForbiddenError({ message: "row-level security violation" }),
      ).toBe(true);
      expect(isForbiddenError({ message: "Failed to fetch" })).toBe(false);
    });

    it("isNetworkError", () => {
      expect(isNetworkError({ message: "Failed to fetch" })).toBe(true);
      expect(isNetworkError({ message: "JWT expired" })).toBe(false);
    });
  });
});
