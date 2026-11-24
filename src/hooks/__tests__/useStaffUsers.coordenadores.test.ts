import { describe, expect, it } from "vitest";
import {
  buildCoordenadorOptions,
  filterCoordenadoresObra,
  type StaffUser,
} from "@/hooks/useStaffUsers";

const u = (id: string, nome: string, email: string, perfil = "admin"): StaffUser => ({
  id,
  nome,
  email,
  perfil,
});

const users: StaffUser[] = [
  u("beatriz", "Beatriz", "beatriz@bwild.com.br"),
  u("bianca", "Bianca Malafaia", "bianca@bwild.com.br", "engineer"),
  u("bruna", "Bruna Sampaio", "bruna.sampaio@bewild.com.br"),
  u("gabi", "Gabriella Franco", "gabriellafranco@bwild.com.br"),
  u("ingrid", "Ingrid", "Ingrid@bewild.com.br"),
  u("isaac", "Isaac", "victor.isaac@bewild.com.br"),
  u("mariana", "Mariana", "mariana@bewild.com.br"),
  u("thiago", "Thiago Dantas", "thiago@bwild.com.br"),
];

describe("opções de coordenador da obra", () => {
  it("oferece Bruna, Bianca, Beatriz, Isaac e Ingrid para novas escolhas", () => {
    expect(filterCoordenadoresObra(users).map((user) => user.id)).toEqual([
      "beatriz",
      "bianca",
      "bruna",
      "ingrid",
      "isaac",
    ]);
  });

  it("não oferece mais a Gabriella nem o resto da equipe", () => {
    const ids = filterCoordenadoresObra(users).map((user) => user.id);
    expect(ids).not.toContain("gabi");
    expect(ids).not.toContain("mariana");
    expect(ids).not.toContain("thiago");
  });

  it("mantém uma atribuição antiga visível sem torná-la elegível", () => {
    expect(buildCoordenadorOptions(users, "gabi").map((user) => user.id)).toEqual([
      "gabi",
      "beatriz",
      "bianca",
      "bruna",
      "ingrid",
      "isaac",
    ]);
  });
});
