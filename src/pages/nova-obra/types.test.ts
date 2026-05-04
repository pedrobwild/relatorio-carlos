import { describe, it, expect } from "vitest";
import {
  formSchema,
  initialFormData,
  initialContractImportState,
  type FormData,
} from "./types";

describe("Nova Obra Types", () => {
  describe("formSchema validation", () => {
    it("validates minimal required fields", () => {
      const data = {
        ...initialFormData,
        name: "Hub Brooklyn",
        customer_name: "João Silva",
        customer_email: "joao@email.com",
        create_user: false,
        is_project_phase: true,
      };
      const result = formSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("rejects missing name", () => {
      const data = {
        ...initialFormData,
        name: "",
        customer_name: "João",
        customer_email: "j@e.com",
        create_user: false,
      };
      const result = formSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("rejects invalid email", () => {
      const data = {
        ...initialFormData,
        name: "X",
        customer_name: "J",
        customer_email: "invalid",
        create_user: false,
      };
      const result = formSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("allows empty password when create_user is false", () => {
      const data = {
        ...initialFormData,
        name: "Obra",
        customer_name: "Cliente",
        customer_email: "c@e.com",
        create_user: false,
        customer_password: "",
        is_project_phase: true,
      };
      const result = formSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("requires password >= 6 chars when create_user is true", () => {
      const data = {
        ...initialFormData,
        name: "Obra",
        customer_name: "Cliente",
        customer_email: "c@e.com",
        create_user: true,
        customer_password: "123",
      };
      const result = formSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("passes with valid password when create_user is true", () => {
      const data = {
        ...initialFormData,
        name: "Obra",
        customer_name: "Cliente",
        customer_email: "c@e.com",
        create_user: true,
        customer_password: "123456",
        is_project_phase: true,
      };
      const result = formSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("requires dates when not project phase", () => {
      const data = {
        ...initialFormData,
        name: "Obra",
        customer_name: "C",
        customer_email: "c@e.com",
        create_user: false,
        is_project_phase: false,
        planned_start_date: "",
        planned_end_date: "",
      };
      const result = formSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("allows missing dates when in project phase", () => {
      const data = {
        ...initialFormData,
        name: "Obra",
        customer_name: "C",
        customer_email: "c@e.com",
        create_user: false,
        is_project_phase: true,
        planned_start_date: "",
        planned_end_date: "",
      };
      const result = formSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("initialContractImportState", () => {
    it("starts with idle status", () => {
      expect(initialContractImportState.parseStatus).toBe("idle");
      expect(initialContractImportState.file).toBeNull();
      expect(initialContractImportState.aiPrefilledFields.size).toBe(0);
      expect(initialContractImportState.aiConflicts).toEqual([]);
    });
  });

  describe("FormData completeness", () => {
    it("initialFormData has all expected contractor fields", () => {
      const fd = initialFormData;
      expect(fd).toHaveProperty("cpf");
      expect(fd).toHaveProperty("rg");
      expect(fd).toHaveProperty("nacionalidade");
      expect(fd).toHaveProperty("estado_civil");
      expect(fd).toHaveProperty("profissao");
      expect(fd).toHaveProperty("endereco_residencial");
      expect(fd).toHaveProperty("cidade_cliente");
      expect(fd).toHaveProperty("estado_cliente");
    });

    it("initialFormData has all expected property fields", () => {
      const fd = initialFormData;
      expect(fd).toHaveProperty("nome_do_empreendimento");
      expect(fd).toHaveProperty("complemento");
      expect(fd).toHaveProperty("tamanho_imovel_m2");
      expect(fd).toHaveProperty("tipo_de_locacao");
      expect(fd).toHaveProperty("data_recebimento_chaves");
      expect(fd).toHaveProperty("cidade_imovel");
    });

    it("initialFormData has commercial fields", () => {
      const fd = initialFormData;
      expect(fd).toHaveProperty("contract_signed_at");
      expect(fd).toHaveProperty("commercial_notes");
      expect(fd).toHaveProperty("budget_uploaded");
      expect(fd).toHaveProperty("budget_file_name");
      expect(fd).toHaveProperty("payment_method");
    });
  });
});
