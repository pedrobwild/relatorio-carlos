/**
 * Schema Validation Tests
 *
 * Smoke tests for critical validation schemas
 */

import { describe, it, expect } from "vitest";
import {
  emailSchema,
  passwordSchema,
  uuidSchema,
  dateSchema,
  loginSchema,
  signupSchema,
  createProjectSchema,
  validateFileUpload,
  MAX_FILE_SIZE_BYTES,
} from "../index";

describe("Common Validators", () => {
  describe("emailSchema", () => {
    it("accepts valid emails", () => {
      expect(emailSchema.parse("test@example.com")).toBe("test@example.com");
      expect(emailSchema.parse("  user@domain.co  ")).toBe("user@domain.co");
    });

    it("rejects invalid emails", () => {
      expect(() => emailSchema.parse("")).toThrow("Email é obrigatório");
      expect(() => emailSchema.parse("invalid")).toThrow("Email inválido");
      expect(() => emailSchema.parse("a@b")).toThrow("Email inválido");
    });

    it("rejects emails that are too long", () => {
      const longEmail = "a".repeat(250) + "@test.com";
      expect(() => emailSchema.parse(longEmail)).toThrow("Email muito longo");
    });
  });

  describe("passwordSchema", () => {
    it("accepts valid passwords", () => {
      expect(passwordSchema.parse("123456")).toBe("123456");
      expect(passwordSchema.parse("securePassword123!")).toBe(
        "securePassword123!",
      );
    });

    it("rejects short passwords", () => {
      expect(() => passwordSchema.parse("12345")).toThrow(
        "mínimo 6 caracteres",
      );
    });

    it("rejects long passwords", () => {
      const longPassword = "a".repeat(129);
      expect(() => passwordSchema.parse(longPassword)).toThrow(
        "Senha muito longa",
      );
    });
  });

  describe("uuidSchema", () => {
    it("accepts valid UUIDs", () => {
      const validUuid = "123e4567-e89b-12d3-a456-426614174000";
      expect(uuidSchema.parse(validUuid)).toBe(validUuid);
    });

    it("rejects invalid UUIDs", () => {
      expect(() => uuidSchema.parse("not-a-uuid")).toThrow("ID inválido");
      expect(() => uuidSchema.parse("")).toThrow("ID inválido");
    });
  });

  describe("dateSchema", () => {
    it("accepts valid dates", () => {
      expect(dateSchema.parse("2024-01-15")).toBe("2024-01-15");
      expect(dateSchema.parse("2023-12-31")).toBe("2023-12-31");
    });

    it("rejects invalid date formats", () => {
      expect(() => dateSchema.parse("15/01/2024")).toThrow("Data inválida");
      expect(() => dateSchema.parse("2024-1-15")).toThrow("Data inválida");
      expect(() => dateSchema.parse("invalid")).toThrow("Data inválida");
    });
  });
});

describe("Auth Schemas", () => {
  describe("loginSchema", () => {
    it("validates correct login data", () => {
      const result = loginSchema.parse({
        email: "test@example.com",
        password: "123456",
      });
      expect(result.email).toBe("test@example.com");
      expect(result.password).toBe("123456");
    });

    it("rejects missing email", () => {
      expect(() => loginSchema.parse({ password: "123456" })).toThrow();
    });

    it("rejects missing password", () => {
      expect(() => loginSchema.parse({ email: "test@example.com" })).toThrow();
    });
  });

  describe("signupSchema", () => {
    it("validates correct signup data", () => {
      const result = signupSchema.parse({
        email: "test@example.com",
        password: "123456",
        confirmPassword: "123456",
        name: "João Silva",
      });
      expect(result.email).toBe("test@example.com");
      expect(result.name).toBe("João Silva");
    });

    it("rejects mismatched passwords", () => {
      expect(() =>
        signupSchema.parse({
          email: "test@example.com",
          password: "123456",
          confirmPassword: "654321",
          name: "João Silva",
        }),
      ).toThrow("Senhas não conferem");
    });

    it("rejects short names", () => {
      expect(() =>
        signupSchema.parse({
          email: "test@example.com",
          password: "123456",
          confirmPassword: "123456",
          name: "A",
        }),
      ).toThrow("mínimo 2 caracteres");
    });
  });
});

describe("Project Schemas", () => {
  describe("createProjectSchema", () => {
    const validProject = {
      name: "Projeto Teste",
      planned_start_date: "2024-01-01",
      planned_end_date: "2024-12-31",
      customer_name: "Cliente Teste",
      customer_email: "cliente@test.com",
    };

    it("validates correct project data", () => {
      const result = createProjectSchema.parse(validProject);
      expect(result.name).toBe("Projeto Teste");
      expect(result.customer_email).toBe("cliente@test.com");
    });

    it("rejects short project names", () => {
      expect(() =>
        createProjectSchema.parse({ ...validProject, name: "AB" }),
      ).toThrow("mínimo 3 caracteres");
    });

    it("rejects invalid customer email", () => {
      expect(() =>
        createProjectSchema.parse({
          ...validProject,
          customer_email: "invalid",
        }),
      ).toThrow("Email inválido");
    });

    it("accepts optional fields as empty", () => {
      const result = createProjectSchema.parse({
        ...validProject,
        unit_name: "",
        address: "",
        customer_phone: "",
      });
      expect(result.unit_name).toBe("");
    });
  });
});

describe("File Upload Validation", () => {
  it("accepts valid PDF file", () => {
    const file = new File(["content"], "doc.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 1024 * 1024 }); // 1MB

    const result = validateFileUpload(file);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("rejects files that are too large", () => {
    const file = new File(["content"], "large.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(file, "size", { value: MAX_FILE_SIZE_BYTES + 1 });

    const result = validateFileUpload(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("muito grande");
  });

  it("rejects unsupported file types", () => {
    const file = new File(["content"], "script.exe", {
      type: "application/x-executable",
    });
    Object.defineProperty(file, "size", { value: 1024 });

    const result = validateFileUpload(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("não permitido");
  });
});
