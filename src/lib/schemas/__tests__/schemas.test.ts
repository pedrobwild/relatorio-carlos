/**
 * Zod Schemas Tests
 *
 * Unit tests for validation schemas.
 */

import { describe, it, expect } from "vitest";
import {
  loginSchema,
  signupSchema,
  createProjectSchema,
  uploadDocumentSchema,
  createFormalizationSchema,
  createPaymentSchema,
  createPurchaseSchema,
  validateFileUpload,
  emailSchema,
  passwordSchema,
  phoneSchema,
  uuidSchema,
  dateSchema,
  MAX_FILE_SIZE_MB,
} from "../index";

describe("emailSchema", () => {
  it("validates correct emails", () => {
    expect(emailSchema.safeParse("test@example.com").success).toBe(true);
    expect(emailSchema.safeParse("user.name@domain.co").success).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(emailSchema.safeParse("invalid").success).toBe(false);
    expect(emailSchema.safeParse("").success).toBe(false);
    expect(emailSchema.safeParse("missing@").success).toBe(false);
  });

  it("trims whitespace", () => {
    const result = emailSchema.parse("  test@example.com  ");
    expect(result).toBe("test@example.com");
  });
});

describe("passwordSchema", () => {
  it("validates passwords with 6+ characters", () => {
    expect(passwordSchema.safeParse("123456").success).toBe(true);
    expect(passwordSchema.safeParse("strongpassword").success).toBe(true);
  });

  it("rejects short passwords", () => {
    expect(passwordSchema.safeParse("12345").success).toBe(false);
    expect(passwordSchema.safeParse("").success).toBe(false);
  });
});

describe("phoneSchema", () => {
  it("validates correct phone numbers", () => {
    expect(phoneSchema.safeParse("(11) 99999-9999").success).toBe(true);
    expect(phoneSchema.safeParse("+55 11 99999-9999").success).toBe(true);
    expect(phoneSchema.safeParse("11999999999").success).toBe(true);
  });

  it("allows empty strings", () => {
    expect(phoneSchema.safeParse("").success).toBe(true);
  });

  it("rejects invalid phone numbers", () => {
    expect(phoneSchema.safeParse("abc").success).toBe(false);
    expect(phoneSchema.safeParse("123").success).toBe(false);
  });
});

describe("uuidSchema", () => {
  it("validates correct UUIDs", () => {
    expect(
      uuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success,
    ).toBe(true);
    expect(
      uuidSchema.safeParse("f47ac10b-58cc-4372-a567-0e02b2c3d479").success,
    ).toBe(true);
  });

  it("rejects invalid UUIDs", () => {
    expect(uuidSchema.safeParse("invalid").success).toBe(false);
    expect(uuidSchema.safeParse("").success).toBe(false);
    expect(uuidSchema.safeParse("550e8400-e29b-41d4-a716").success).toBe(false);
  });
});

describe("dateSchema", () => {
  it("validates YYYY-MM-DD format", () => {
    expect(dateSchema.safeParse("2024-01-15").success).toBe(true);
    expect(dateSchema.safeParse("2023-12-31").success).toBe(true);
  });

  it("rejects invalid date formats", () => {
    expect(dateSchema.safeParse("15/01/2024").success).toBe(false);
    expect(dateSchema.safeParse("2024/01/15").success).toBe(false);
    expect(dateSchema.safeParse("").success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("validates correct login data", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fields", () => {
    expect(loginSchema.safeParse({ email: "test@example.com" }).success).toBe(
      false,
    );
    expect(loginSchema.safeParse({ password: "123456" }).success).toBe(false);
    expect(loginSchema.safeParse({}).success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("validates correct signup data", () => {
    const result = signupSchema.safeParse({
      email: "test@example.com",
      password: "123456",
      confirmPassword: "123456",
      name: "John Doe",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = signupSchema.safeParse({
      email: "test@example.com",
      password: "123456",
      confirmPassword: "654321",
      name: "John Doe",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("confirmPassword");
    }
  });

  it("rejects short names", () => {
    const result = signupSchema.safeParse({
      email: "test@example.com",
      password: "123456",
      confirmPassword: "123456",
      name: "J",
    });
    expect(result.success).toBe(false);
  });
});

describe("createProjectSchema", () => {
  const validProject = {
    name: "Projeto Teste",
    planned_start_date: "2024-01-01",
    planned_end_date: "2024-12-31",
    customer_name: "Cliente Teste",
    customer_email: "cliente@example.com",
  };

  it("validates correct project data", () => {
    expect(createProjectSchema.safeParse(validProject).success).toBe(true);
  });

  it("validates with optional fields", () => {
    const result = createProjectSchema.safeParse({
      ...validProject,
      unit_name: "Unidade 101",
      address: "Rua Teste, 123",
      contract_value: 100000,
      customer_phone: "(11) 99999-9999",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short project name", () => {
    const result = createProjectSchema.safeParse({
      ...validProject,
      name: "AB",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid customer email", () => {
    const result = createProjectSchema.safeParse({
      ...validProject,
      customer_email: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("uploadDocumentSchema", () => {
  it("validates correct document upload data", () => {
    const result = uploadDocumentSchema.safeParse({
      project_id: "550e8400-e29b-41d4-a716-446655440000",
      document_type: "contrato",
      name: "Contrato Principal",
    });
    expect(result.success).toBe(true);
  });

  it("validates all document categories", () => {
    const categories = [
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

    for (const category of categories) {
      const result = uploadDocumentSchema.safeParse({
        project_id: "550e8400-e29b-41d4-a716-446655440000",
        document_type: category,
        name: "Documento Teste",
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid document category", () => {
    const result = uploadDocumentSchema.safeParse({
      project_id: "550e8400-e29b-41d4-a716-446655440000",
      document_type: "invalid_type",
      name: "Documento",
    });
    expect(result.success).toBe(false);
  });
});

describe("createFormalizationSchema", () => {
  const validFormalization = {
    type: "meeting_minutes",
    title: "Ata de Reunião - Kick-off",
    summary: "Resumo detalhado da reunião inicial do projeto",
    body_md: "Conteúdo completo da ata em markdown com todos os detalhes...",
    parties: [
      {
        display_name: "João Silva",
        party_type: "customer",
        must_sign: true,
      },
    ],
  };

  it("validates correct formalization data", () => {
    const result = createFormalizationSchema.safeParse(validFormalization);
    expect(result.success).toBe(true);
  });

  it("validates all formalization types", () => {
    const types = [
      "meeting_minutes",
      "budget_item_swap",
      "exception_custody",
      "general",
    ];

    for (const type of types) {
      const result = createFormalizationSchema.safeParse({
        ...validFormalization,
        type,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects empty parties array", () => {
    const result = createFormalizationSchema.safeParse({
      ...validFormalization,
      parties: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects short title", () => {
    const result = createFormalizationSchema.safeParse({
      ...validFormalization,
      title: "Ata",
    });
    expect(result.success).toBe(false);
  });
});

describe("createPaymentSchema", () => {
  it("validates correct payment data", () => {
    const result = createPaymentSchema.safeParse({
      project_id: "550e8400-e29b-41d4-a716-446655440000",
      description: "Parcela 1 - Projeto",
      amount: 10000,
      due_date: "2024-02-15",
      installment_number: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative amount", () => {
    const result = createPaymentSchema.safeParse({
      project_id: "550e8400-e29b-41d4-a716-446655440000",
      description: "Parcela 1",
      amount: -100,
      due_date: "2024-02-15",
      installment_number: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero installment number", () => {
    const result = createPaymentSchema.safeParse({
      project_id: "550e8400-e29b-41d4-a716-446655440000",
      description: "Parcela 1",
      amount: 10000,
      due_date: "2024-02-15",
      installment_number: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe("createPurchaseSchema", () => {
  it("validates correct purchase data", () => {
    const result = createPurchaseSchema.safeParse({
      project_id: "550e8400-e29b-41d4-a716-446655440000",
      item_name: "Piso Porcelanato",
      quantity: 50,
      unit: "m²",
      required_by_date: "2024-03-01",
      lead_time_days: 15,
    });
    expect(result.success).toBe(true);
  });

  it("allows optional fields", () => {
    const result = createPurchaseSchema.safeParse({
      project_id: "550e8400-e29b-41d4-a716-446655440000",
      item_name: "Tinta",
      required_by_date: "2024-03-01",
    });
    expect(result.success).toBe(true);
  });
});

describe("validateFileUpload", () => {
  it("validates correct PDF file", () => {
    const file = new File(["content"], "document.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(file, "size", { value: 1024 * 1024 }); // 1MB

    const result = validateFileUpload(file);
    expect(result.valid).toBe(true);
  });

  it("rejects file too large", () => {
    const file = new File(["content"], "large.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(file, "size", {
      value: (MAX_FILE_SIZE_MB + 1) * 1024 * 1024,
    });

    const result = validateFileUpload(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Arquivo muito grande");
  });

  it("rejects unsupported file type", () => {
    const file = new File(["content"], "script.exe", {
      type: "application/x-executable",
    });
    Object.defineProperty(file, "size", { value: 1024 });

    const result = validateFileUpload(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Tipo de arquivo não permitido");
  });
});
