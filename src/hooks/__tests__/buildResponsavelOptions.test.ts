import { describe, it, expect } from "vitest";
import { buildResponsavelOptions } from "../usePainelObras";

type Row = { responsavel_id: string | null; responsavel_nome: string | null };

const obra = (id: string | null, nome: string | null = null): Row => ({
  responsavel_id: id,
  responsavel_nome: nome,
});

/**
 * O filtro "Resp." do Painel de Obras listava TODO o staff ativo. Como o
 * gestor só podia ser definido numa coluna escondida abaixo de 1280px, quase
 * nenhuma obra tinha gestor e praticamente toda opção filtrava para zero —
 * dando a impressão de que os nomes não vinham de lugar nenhum.
 *
 * As opções agora saem das obras reais, com contagem.
 */
describe("buildResponsavelOptions", () => {
  it("lista apenas gestores que têm obra, com a contagem de cada um", () => {
    const { comGestor } = buildResponsavelOptions([
      obra("u1", "Ana"),
      obra("u2", "Bruno"),
      obra("u1", "Ana"),
      obra(null),
    ]);

    expect(comGestor).toEqual([
      { id: "u1", nome: "Ana", total: 2 },
      { id: "u2", nome: "Bruno", total: 1 },
    ]);
  });

  it("nunca inclui staff sem obra — a opção morta era o bug", () => {
    const { comGestor } = buildResponsavelOptions([obra("u1", "Ana")]);
    // "Bruno" existe no staff mas não é gestor de nada: não pode aparecer.
    expect(comGestor.map((g) => g.id)).toEqual(["u1"]);
  });

  it("conta separadamente as obras sem gestor", () => {
    const { semGestor } = buildResponsavelOptions([
      obra(null),
      obra(null),
      obra("u1", "Ana"),
    ]);
    expect(semGestor).toBe(2);
  });

  it("uma obra conta para exatamente um gestor (soma fecha com o total)", () => {
    const rows = [
      obra("u1", "Ana"),
      obra("u2", "Bruno"),
      obra("u1", "Ana"),
      obra(null),
      obra("u3", "Carla"),
    ];
    const { comGestor, semGestor } = buildResponsavelOptions(rows);
    const somaComGestor = comGestor.reduce((acc, g) => acc + g.total, 0);
    expect(somaComGestor + semGestor).toBe(rows.length);
  });

  it("ordena por nome em pt-BR (acento não vai para o fim)", () => {
    const { comGestor } = buildResponsavelOptions([
      obra("u1", "Zeca"),
      obra("u2", "Ávila"),
      obra("u3", "Bruno"),
    ]);
    expect(comGestor.map((g) => g.nome)).toEqual(["Ávila", "Bruno", "Zeca"]);
  });

  it("não quebra quando o nome do gestor ainda não resolveu", () => {
    const { comGestor } = buildResponsavelOptions([obra("u1", null)]);
    expect(comGestor).toEqual([
      { id: "u1", nome: "Gestor sem nome", total: 1 },
    ]);
  });

  it("adota o nome resolvido em qualquer linha do mesmo gestor", () => {
    const { comGestor } = buildResponsavelOptions([
      obra("u1", null),
      obra("u1", "Ana"),
    ]);
    expect(comGestor).toEqual([{ id: "u1", nome: "Ana", total: 2 }]);
  });

  it("lista vazia não gera opções nem contagem", () => {
    expect(buildResponsavelOptions([])).toEqual({
      comGestor: [],
      semGestor: 0,
    });
  });
});
