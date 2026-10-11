import { describe, it, expect } from "vitest";
import {
  defaultMenuMode,
  isFieldOnlyRoles,
  menuModeStorageKey,
  readMenuModeOverride,
  resolveMenuMode,
  writeMenuModeOverride,
} from "../menuMode";

describe("menuMode · regras do modo simples (Fase 0)", () => {
  describe("isFieldOnlyRoles", () => {
    it("gestor e/ou engineer sozinhos são 'campo'", () => {
      expect(isFieldOnlyRoles(["gestor"])).toBe(true);
      expect(isFieldOnlyRoles(["engineer"])).toBe(true);
      expect(isFieldOnlyRoles(["gestor", "engineer"])).toBe(true);
    });

    it("qualquer papel de escritório tira o usuário do modo simples", () => {
      expect(isFieldOnlyRoles(["engineer", "admin"])).toBe(false);
      expect(isFieldOnlyRoles(["gestor", "manager"])).toBe(false);
      expect(isFieldOnlyRoles(["gestor", "suprimentos"])).toBe(false);
      expect(isFieldOnlyRoles(["financeiro"])).toBe(false);
      expect(isFieldOnlyRoles(["cs"])).toBe(false);
      expect(isFieldOnlyRoles(["arquitetura"])).toBe(false);
    });

    it("sem papel carregado não assume modo simples", () => {
      expect(isFieldOnlyRoles([])).toBe(false);
    });

    it("cliente nunca é 'campo'", () => {
      expect(isFieldOnlyRoles(["customer"])).toBe(false);
    });
  });

  describe("defaultMenuMode", () => {
    it("flag desligada → sempre completo", () => {
      expect(defaultMenuMode({ flagEnabled: false, roles: ["gestor"] })).toBe("full");
    });

    it("flag ligada + papel de campo → simples", () => {
      expect(defaultMenuMode({ flagEnabled: true, roles: ["gestor"] })).toBe("simple");
      expect(defaultMenuMode({ flagEnabled: true, roles: ["engineer"] })).toBe("simple");
    });

    it("flag ligada + papel de escritório → completo", () => {
      expect(defaultMenuMode({ flagEnabled: true, roles: ["admin"] })).toBe("full");
      expect(defaultMenuMode({ flagEnabled: true, roles: ["engineer", "admin"] })).toBe("full");
    });
  });

  describe("resolveMenuMode", () => {
    it("override do usuário vence a regra padrão nos dois sentidos", () => {
      expect(
        resolveMenuMode({ flagEnabled: true, roles: ["gestor"], override: "full" }),
      ).toBe("full");
      expect(
        resolveMenuMode({ flagEnabled: true, roles: ["admin"], override: "simple" }),
      ).toBe("simple");
    });

    it("sem override cai no padrão", () => {
      expect(
        resolveMenuMode({ flagEnabled: true, roles: ["gestor"], override: null }),
      ).toBe("simple");
      expect(
        resolveMenuMode({ flagEnabled: false, roles: ["gestor"], override: null }),
      ).toBe("full");
    });
  });

  describe("persistência", () => {
    function memoryStorage() {
      const map = new Map<string, string>();
      return {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
        removeItem: (k: string) => void map.delete(k),
        map,
      };
    }

    it("chave é por usuário", () => {
      expect(menuModeStorageKey("u1")).not.toBe(menuModeStorageKey("u2"));
      expect(menuModeStorageKey(null)).toContain("anon");
    });

    it("escreve, lê e limpa o override", () => {
      const s = memoryStorage();
      writeMenuModeOverride(s, "u1", "full");
      expect(readMenuModeOverride(s, "u1")).toBe("full");
      expect(readMenuModeOverride(s, "u2")).toBeNull();
      writeMenuModeOverride(s, "u1", null);
      expect(readMenuModeOverride(s, "u1")).toBeNull();
    });

    it("ignora valores inválidos e storage ausente", () => {
      const s = memoryStorage();
      s.setItem(menuModeStorageKey("u1"), "banana");
      expect(readMenuModeOverride(s, "u1")).toBeNull();
      expect(readMenuModeOverride(null, "u1")).toBeNull();
      expect(() => writeMenuModeOverride(null, "u1", "simple")).not.toThrow();
    });
  });
});
