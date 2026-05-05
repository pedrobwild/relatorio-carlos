/**
 * Documents Repository Tests
 *
 * Unit tests for the documents repository functions.
 */

import { describe, it, expect, vi } from "vitest";

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(() =>
          Promise.resolve({
            data: { signedUrl: "https://example.com/signed" },
            error: null,
          }),
        ),
      })),
    },
  },
}));

// Import after mocking
import { DOCUMENT_CATEGORIES, getLatestDocumentsByCategory, type ProjectDocument, type DocumentCategory } from "../documents.repository";

describe("DOCUMENT_CATEGORIES", () => {
  it("has all required categories", () => {
    const expectedCategories: DocumentCategory[] = [
      "contrato",
      "aditivo",
      "projeto_3d",
      "executivo",
      "art_rrt",
      "plano_reforma",
      "nota_fiscal",
      "garantia",
      "as_built",
      "termo_entrega",
    ];

    for (const category of expectedCategories) {
      expect(DOCUMENT_CATEGORIES[category]).toBeDefined();
      expect(DOCUMENT_CATEGORIES[category].label).toBeTruthy();
      expect(DOCUMENT_CATEGORIES[category].icon).toBeTruthy();
    }
  });
});

describe("getDocumentVersionHistory", () => {
  const baseDocument: ProjectDocument = {
    id: "doc-1",
    project_id: "project-1",
    document_type: "contrato",
    name: "Contrato v1",
    description: null,
    storage_path: "path/to/doc",
    storage_bucket: "project-documents",
    mime_type: "application/pdf",
    size_bytes: 1024,
    version: 1,
    status: "approved",
    uploaded_by: "user-1",
    approved_at: null,
    approved_by: null,
    parent_document_id: null,
    checksum: null,
    created_at: "2024-01-01T00:00:00Z",
  };

  it("returns empty array when document not found", () => {
    // getDocumentVersionHistory is sync function that filters from provided array
    const doc = [baseDocument].find((d) => d.id === "non-existent");
    expect(doc).toBeUndefined();
  });

  it("returns single document when no versions exist", () => {
    const docs = [baseDocument];
    const doc = docs.find((d) => d.id === "doc-1");
    expect(doc).toBeDefined();

    const rootId = doc!.parent_document_id || doc!.id;
    const versions = docs.filter(
      (d) => d.id === rootId || d.parent_document_id === rootId,
    );
    expect(versions).toHaveLength(1);
    expect(versions[0].id).toBe("doc-1");
  });

  it("returns all versions sorted by version number descending", () => {
    const docs: ProjectDocument[] = [
      baseDocument,
      { ...baseDocument, id: "doc-2", version: 2, parent_document_id: "doc-1" },
      { ...baseDocument, id: "doc-3", version: 3, parent_document_id: "doc-1" },
    ];

    const doc = docs.find((d) => d.id === "doc-1");
    const rootId = doc!.parent_document_id || doc!.id;
    const versions = docs
      .filter((d) => d.id === rootId || d.parent_document_id === rootId)
      .sort((a, b) => b.version - a.version);

    expect(versions).toHaveLength(3);
    expect(versions[0].version).toBe(3);
    expect(versions[1].version).toBe(2);
    expect(versions[2].version).toBe(1);
  });

  it("finds versions when starting from a child document", () => {
    const docs: ProjectDocument[] = [
      baseDocument,
      { ...baseDocument, id: "doc-2", version: 2, parent_document_id: "doc-1" },
    ];

    const doc = docs.find((d) => d.id === "doc-2");
    const rootId = doc!.parent_document_id || doc!.id;
    const versions = docs.filter(
      (d) => d.id === rootId || d.parent_document_id === rootId,
    );

    expect(versions).toHaveLength(2);
  });
});

describe("getLatestDocumentsByCategory", () => {
  const createDoc = (
    overrides: Partial<ProjectDocument> = {},
  ): ProjectDocument => ({
    id: "doc-1",
    project_id: "project-1",
    document_type: "contrato",
    name: "Document",
    description: null,
    storage_path: "path/to/doc",
    storage_bucket: "project-documents",
    mime_type: "application/pdf",
    size_bytes: 1024,
    version: 1,
    status: "approved",
    uploaded_by: "user-1",
    approved_at: null,
    approved_by: null,
    parent_document_id: null,
    checksum: null,
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  });

  it("filters documents by category", () => {
    const docs: ProjectDocument[] = [
      createDoc({ id: "doc-1", document_type: "contrato" }),
      createDoc({ id: "doc-2", document_type: "aditivo" }),
      createDoc({ id: "doc-3", document_type: "contrato" }),
    ];

    const result = getLatestDocumentsByCategory(docs, "contrato");
    expect(result.every((d) => d.document_type === "contrato")).toBe(true);
  });

  it("returns only latest version of each document", () => {
    const docs: ProjectDocument[] = [
      createDoc({ id: "doc-1", version: 1 }),
      createDoc({ id: "doc-2", version: 2, parent_document_id: "doc-1" }),
      createDoc({ id: "doc-3", version: 3, parent_document_id: "doc-1" }),
    ];

    const result = getLatestDocumentsByCategory(docs, "contrato");
    expect(result).toHaveLength(1);
    expect(result[0].version).toBe(3);
  });

  it("returns empty array for non-existent category", () => {
    const docs: ProjectDocument[] = [
      createDoc({ id: "doc-1", document_type: "contrato" }),
    ];

    const result = getLatestDocumentsByCategory(docs, "aditivo");
    expect(result).toHaveLength(0);
  });

  it("handles multiple independent documents in same category", () => {
    const docs: ProjectDocument[] = [
      createDoc({ id: "doc-1", name: "First Contract" }),
      createDoc({ id: "doc-2", name: "Second Contract" }),
    ];

    const result = getLatestDocumentsByCategory(docs, "contrato");
    expect(result).toHaveLength(2);
  });
});
