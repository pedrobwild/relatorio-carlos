import { describe, it, expect } from "vitest";
import {
  buildProjectOptionValue,
  scoreProjectOption,
} from "../projectSearch";

/**
 * Regressão do bug "obras que não aparecem na lista de seleção de tickets".
 *
 * O filtro do cmdk recebe o `value` do item com a caixa original (nomes de
 * obra costumam começar com maiúscula). Antes da correção o termo digitado era
 * baixado para minúsculo mas o texto do item não, então a busca era sensível a
 * maiúsculas/minúsculas e obras "sumiam".
 */
describe("scoreProjectOption", () => {
  const OBRA = "Casa Ricardo Macedo — João da Silva";

  it("retorna 1 (mantém tudo) quando a busca está vazia", () => {
    expect(scoreProjectOption(OBRA, "", "tokens")).toBe(1);
    expect(scoreProjectOption(OBRA, "   ", "substring")).toBe(1);
  });

  it("casa termo em minúsculo com nome capitalizado (tokens)", () => {
    // Este é exatamente o caso que falhava antes da correção.
    expect(scoreProjectOption(OBRA, "ricardo", "tokens")).toBe(1);
    expect(scoreProjectOption(OBRA, "casa", "tokens")).toBe(1);
    expect(scoreProjectOption(OBRA, "joao", "tokens")).toBe(1);
  });

  it("casa termo em minúsculo com nome capitalizado (substring)", () => {
    expect(scoreProjectOption(OBRA, "casa ric", "substring")).toBe(1);
    expect(scoreProjectOption(OBRA, "ardo mac", "substring")).toBe(1);
  });

  it("é insensível a acentos nos dois lados", () => {
    expect(scoreProjectOption(OBRA, "joão", "tokens")).toBe(1);
    expect(scoreProjectOption("Apartamento São João", "sao joao", "tokens")).toBe(
      1,
    );
  });

  it("no modo tokens exige todas as palavras, em qualquer ordem", () => {
    expect(scoreProjectOption(OBRA, "silva ricardo", "tokens")).toBe(1);
    expect(scoreProjectOption(OBRA, "ricardo inexistente", "tokens")).toBe(0);
  });

  it("no modo substring exige a sequência contígua", () => {
    expect(scoreProjectOption(OBRA, "ricardo macedo", "substring")).toBe(1);
    // 'silva ricardo' não é contíguo no texto → não casa em substring
    expect(scoreProjectOption(OBRA, "silva ricardo", "substring")).toBe(0);
  });

  it("não casa quando o termo não existe", () => {
    expect(scoreProjectOption(OBRA, "pedro", "tokens")).toBe(0);
    expect(scoreProjectOption(OBRA, "xyz", "substring")).toBe(0);
  });

  it("casa pelo rótulo mesmo com o id de unicidade anexado ao value", () => {
    // O value real do CommandItem inclui o id da obra para garantir unicidade.
    const valueComId = buildProjectOptionValue(
      OBRA,
      "550e8400-e29b-41d4-a716-446655440000",
    );
    expect(scoreProjectOption(valueComId, "ricardo", "tokens")).toBe(1);
    expect(scoreProjectOption(valueComId, "casa ric", "substring")).toBe(1);
  });

  it("NÃO torna fragmentos do UUID pesquisáveis (regressão do review Codex)", () => {
    // UUID cheio de hex; buscas por caracteres/fragmentos do id não podem
    // manter a obra na lista se não casarem com o rótulo visível.
    const uuid = "4a04f00e-29b4-41d4-a716-446655440000";
    const valueComId = buildProjectOptionValue("Casa Silva", uuid);

    // 'a' e '4' aparecem no UUID mas não são termos úteis do rótulo → 0.
    expect(scoreProjectOption(valueComId, "446655", "substring")).toBe(0);
    expect(scoreProjectOption(valueComId, "e29b", "tokens")).toBe(0);
    // Sanidade: o rótulo em si continua casando.
    expect(scoreProjectOption(valueComId, "silva", "tokens")).toBe(1);
  });
});
