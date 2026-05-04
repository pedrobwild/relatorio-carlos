import { describe, expect, it } from "vitest";
import { validateSql } from "../sqlGuardrails";

describe("validateSql", () => {
  it("accepts a clean SELECT", () => {
    const r = validateSql(
      "SELECT id, amount FROM project_payments WHERE due_date < CURRENT_DATE",
    );
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("rejects empty SQL", () => {
    const r = validateSql("");
    expect(r.ok).toBe(false);
    expect(r.errors[0].code).toBe("empty");
  });

  it("rejects multiple statements", () => {
    const r = validateSql("SELECT 1; SELECT 2");
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "multiple_statements")).toBe(true);
  });

  it("rejects DML/DDL", () => {
    expect(validateSql("UPDATE projects SET name='x'").ok).toBe(false);
    expect(validateSql("DROP TABLE projects").ok).toBe(false);
    expect(validateSql("INSERT INTO projects (name) VALUES ('x')").ok).toBe(
      false,
    );
  });

  it("rejects internal schemas", () => {
    const r = validateSql("SELECT * FROM auth.users");
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "internal_schema")).toBe(true);
  });

  it("rejects pg_sleep and friends", () => {
    expect(validateSql("SELECT pg_sleep(10)").ok).toBe(false);
  });

  it("warns on SELECT *", () => {
    const r = validateSql("SELECT * FROM project_payments");
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === "select_star")).toBe(true);
  });

  it("flags forbidden columns", () => {
    const r = validateSql(
      "SELECT project_payments.status FROM project_payments",
    );
    expect(r.errors.some((e) => e.code === "forbidden_column")).toBe(true);
  });

  it("warns on unknown table", () => {
    const r = validateSql("SELECT id FROM unknown_table");
    expect(r.warnings.some((w) => w.code === "unknown_table")).toBe(true);
  });

  it("strips trailing semicolon", () => {
    const r = validateSql("SELECT id FROM projects;");
    expect(r.cleanedSql).toBe("SELECT id FROM projects");
    expect(r.ok).toBe(true);
  });
});
