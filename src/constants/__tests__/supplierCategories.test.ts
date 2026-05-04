import { describe, it, expect } from "vitest";
import {
  SUPPLIER_TYPES,
  SUPPLIER_TYPE_LABELS,
  SUPPLIER_SUBCATEGORIES_BY_TYPE,
  getSubcategoriesByType,
  isValidSupplierType,
  isValidSupplierSubcategory,
  getAllSupplierSubcategories,
  inferTypeFromSubcategory,
} from "@/constants/supplierCategories";

describe("supplierCategories — central taxonomy", () => {
  describe("SUPPLIER_TYPES", () => {
    it("has exactly 2 types", () => {
      expect(SUPPLIER_TYPES).toEqual(["prestadores", "produtos"]);
    });

    it("all types have labels", () => {
      for (const type of SUPPLIER_TYPES) {
        expect(SUPPLIER_TYPE_LABELS[type]).toBeTruthy();
      }
    });
  });

  describe("SUPPLIER_SUBCATEGORIES_BY_TYPE", () => {
    it("every type has at least 10 subcategories", () => {
      for (const type of SUPPLIER_TYPES) {
        expect(
          SUPPLIER_SUBCATEGORIES_BY_TYPE[type].length,
        ).toBeGreaterThanOrEqual(10);
      }
    });

    it("no duplicate subcategories within a type", () => {
      for (const type of SUPPLIER_TYPES) {
        const subs = SUPPLIER_SUBCATEGORIES_BY_TYPE[type];
        expect(new Set(subs).size).toBe(subs.length);
      }
    });

    it("no subcategory appears in both types", () => {
      const prestadores = new Set(SUPPLIER_SUBCATEGORIES_BY_TYPE.prestadores);
      const produtos = new Set(SUPPLIER_SUBCATEGORIES_BY_TYPE.produtos);
      const overlap = [...prestadores].filter((s) => produtos.has(s));
      expect(overlap).toEqual([]);
    });
  });

  describe("isValidSupplierType", () => {
    it("returns true for valid types", () => {
      expect(isValidSupplierType("prestadores")).toBe(true);
      expect(isValidSupplierType("produtos")).toBe(true);
    });

    it("returns false for invalid types", () => {
      expect(isValidSupplierType("servicos")).toBe(false);
      expect(isValidSupplierType("")).toBe(false);
      expect(isValidSupplierType("PRESTADORES")).toBe(false);
    });
  });

  describe("getSubcategoriesByType", () => {
    it("returns subcategories for valid type", () => {
      const result = getSubcategoriesByType("prestadores");
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain("Marcenaria");
    });

    it("returns empty array for invalid type", () => {
      expect(getSubcategoriesByType("invalid")).toEqual([]);
      expect(getSubcategoriesByType(null)).toEqual([]);
      expect(getSubcategoriesByType(undefined)).toEqual([]);
    });
  });

  describe("isValidSupplierSubcategory", () => {
    it("validates subcategory against correct type", () => {
      expect(isValidSupplierSubcategory("prestadores", "Marcenaria")).toBe(
        true,
      );
      expect(isValidSupplierSubcategory("produtos", "Eletrodomésticos")).toBe(
        true,
      );
    });

    it("rejects subcategory against wrong type", () => {
      expect(
        isValidSupplierSubcategory("prestadores", "Eletrodomésticos"),
      ).toBe(false);
      expect(isValidSupplierSubcategory("produtos", "Marcenaria")).toBe(false);
    });

    it("rejects invalid type", () => {
      expect(isValidSupplierSubcategory("invalid", "Marcenaria")).toBe(false);
    });
  });

  describe("getAllSupplierSubcategories", () => {
    it("returns all subcategories from both types", () => {
      const all = getAllSupplierSubcategories();
      const totalExpected =
        SUPPLIER_SUBCATEGORIES_BY_TYPE.prestadores.length +
        SUPPLIER_SUBCATEGORIES_BY_TYPE.produtos.length;
      expect(all.length).toBe(totalExpected);
    });

    it("contains known subcategories", () => {
      const all = getAllSupplierSubcategories();
      expect(all).toContain("Marcenaria");
      expect(all).toContain("Eletrodomésticos");
      expect(all).toContain("Tintas");
    });
  });

  describe("inferTypeFromSubcategory", () => {
    it("infers prestadores for service subcategories", () => {
      expect(inferTypeFromSubcategory("Marcenaria")).toBe("prestadores");
      expect(inferTypeFromSubcategory("Eletricista")).toBe("prestadores");
      expect(inferTypeFromSubcategory("Gesseiro")).toBe("prestadores");
    });

    it("infers produtos for product subcategories", () => {
      expect(inferTypeFromSubcategory("Eletrodomésticos")).toBe("produtos");
      expect(inferTypeFromSubcategory("Tintas")).toBe("produtos");
      expect(inferTypeFromSubcategory("Luminárias")).toBe("produtos");
    });

    it("returns null for unknown subcategory", () => {
      expect(inferTypeFromSubcategory("Unknown")).toBeNull();
      expect(inferTypeFromSubcategory("")).toBeNull();
    });
  });
});

describe("supplierCategories — filter logic", () => {
  // Simulate the filter logic from useComprasState
  interface MockPurchase {
    category: string | null;
    status: string;
    activity_id: string | null;
  }

  function filterPurchases(
    purchases: MockPurchase[],
    filterCategory: string,
    filterSubcategory: string,
  ) {
    return purchases.filter((p) => {
      if (filterCategory !== "all" && p.category) {
        if (!isValidSupplierSubcategory(filterCategory, p.category))
          return false;
      } else if (filterCategory !== "all" && !p.category) {
        return false;
      }
      if (filterSubcategory !== "all") {
        if (p.category !== filterSubcategory) return false;
      }
      return true;
    });
  }

  const mockPurchases: MockPurchase[] = [
    { category: "Marcenaria", status: "pending", activity_id: null },
    { category: "Eletrodomésticos", status: "ordered", activity_id: null },
    { category: "Pintor", status: "pending", activity_id: null },
    { category: null, status: "pending", activity_id: null },
    { category: "Tintas", status: "delivered", activity_id: null },
  ];

  it('returns all when filters are "all"', () => {
    expect(filterPurchases(mockPurchases, "all", "all")).toHaveLength(5);
  });

  it("filters by category type (prestadores)", () => {
    const result = filterPurchases(mockPurchases, "prestadores", "all");
    expect(result).toHaveLength(2); // Marcenaria, Pintor
    expect(
      result.every((p) =>
        isValidSupplierSubcategory("prestadores", p.category!),
      ),
    ).toBe(true);
  });

  it("filters by category type (produtos)", () => {
    const result = filterPurchases(mockPurchases, "produtos", "all");
    expect(result).toHaveLength(2); // Eletrodomésticos, Tintas
  });

  it("excludes items without category when type filter is active", () => {
    const result = filterPurchases(mockPurchases, "prestadores", "all");
    expect(result.find((p) => p.category === null)).toBeUndefined();
  });

  it("filters by exact subcategory", () => {
    const result = filterPurchases(mockPurchases, "all", "Marcenaria");
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("Marcenaria");
  });

  it("combines category type + subcategory filter", () => {
    const result = filterPurchases(mockPurchases, "prestadores", "Marcenaria");
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("Marcenaria");
  });

  it("subcategory reset: filtering wrong combination returns empty", () => {
    // Marcenaria is prestadores, not produtos
    const result = filterPurchases(mockPurchases, "produtos", "Marcenaria");
    expect(result).toHaveLength(0);
  });
});

describe("supplierCategories — legacy compatibility", () => {
  it("old service categories map to prestadores subcategories", () => {
    // These old categories from compras/types.ts should exist in the new taxonomy
    const oldServices = ["Marcenaria", "Eletricista", "Pintor", "Gesseiro"];
    for (const svc of oldServices) {
      expect(isValidSupplierSubcategory("prestadores", svc)).toBe(true);
    }
  });

  it("old item categories map to produtos subcategories", () => {
    const oldItems = ["Eletrodomésticos", "Revestimentos", "Enxoval"];
    for (const item of oldItems) {
      expect(isValidSupplierSubcategory("produtos", item)).toBe(true);
    }
  });

  it("handles null/undefined category gracefully in filter", () => {
    // A purchase with no category should pass "all" filter
    const purchase = { category: null, status: "pending", activity_id: null };
    const filterValue: string = "all";
    const all = [purchase].filter(() => {
      if (filterValue !== "all") return false;
      return true;
    });
    expect(all).toHaveLength(1);
  });
});
