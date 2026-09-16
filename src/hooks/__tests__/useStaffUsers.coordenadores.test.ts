import { describe, expect, it } from "vitest";
import {
  buildCoordenadorOptions,
  filterCoordenadoresObra,
  type StaffUser,
} from "@/hooks/useStaffUsers";

const users: StaffUser[] = [
  {
    id: "gabi",
    nome: "Gabriella Franco",
    email: "gabriellafranco@bwild.com.br",
    perfil: "admin",
  },
  {
    id: "bruna",
    nome: "Bruna Sampaio",
    email: "bruna.sampaio@bewild.com.br",
    perfil: "admin",
  },
  {
    id: "outra",
    nome: "Outra Pessoa",
    email: "outra@bwild.com.br",
    perfil: "gestor",
  },
];

describe("opções de coordenador da obra", () => {
  it("oferece somente Gabriella e Bruna para novas escolhas", () => {
    expect(filterCoordenadoresObra(users).map((user) => user.nome)).toEqual([
      "Gabriella Franco",
      "Bruna Sampaio",
    ]);
  });

  it("mantém uma atribuição antiga visível sem torná-la elegível", () => {
    expect(buildCoordenadorOptions(users, "outra").map((user) => user.id)).toEqual([
      "outra",
      "gabi",
      "bruna",
    ]);
  });
});