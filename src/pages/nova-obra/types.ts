import { z } from "zod";
import { isValidCpf, isValidRg } from "@/lib/documentValidation";

export const formSchema = z
  .object({
    // ── Obra / Imóvel ──
    name: z.string().trim().min(1, "Condomínio é obrigatório").max(200),
    unit_name: z.string().trim().max(100).optional(),
    nome_do_empreendimento: z.string().trim().max(200).optional(),
    address: z.string().trim().max(300).optional(),
    bairro: z.string().trim().max(100).optional(),
    cep: z.string().trim().max(10).optional(),
    complemento: z.string().trim().max(200).optional(),
    cidade_imovel: z.string().trim().max(100).optional(),
    tamanho_imovel_m2: z.string().optional(),
    tipo_de_locacao: z.string().optional(),
    data_recebimento_chaves: z.string().optional(),
    is_project_phase: z.boolean(),

    // ── Cronograma ──
    planned_start_date: z.string().optional(),
    planned_end_date: z.string().optional(),
    business_days_duration: z.string().optional(),
    contract_signing_date: z.string().optional(),

    // ── Comercial / Financeiro ──
    contract_value: z.string().optional(),
    num_installments: z.string().optional(),
    installment_value: z.string().optional(),
    payment_method: z.string().optional(),
    payment_status: z.string().optional(),
    contract_signed_at: z.string().optional(),
    commercial_notes: z.string().trim().max(1000).optional(),
    contract_document_name: z.string().trim().max(200).optional(),
    budget_uploaded: z.boolean(),
    budget_file_name: z.string().optional(),

    // ── Contratante ──
    customer_name: z
      .string()
      .trim()
      .min(1, "Nome do cliente é obrigatório")
      .max(200),
    customer_email: z.string().trim().email("E-mail inválido").max(255),
    customer_phone: z.string().trim().max(20).optional(),
    nacionalidade: z.string().trim().max(100).optional(),
    estado_civil: z.string().trim().max(50).optional(),
    profissao: z.string().trim().max(100).optional(),
    cpf: z
      .string()
      .trim()
      .max(20)
      .optional()
      .refine((v) => !v || v.replace(/\D/g, "").length === 0 || isValidCpf(v), {
        message: "CPF inválido",
      }),
    rg: z
      .string()
      .trim()
      .max(20)
      .optional()
      .refine(
        (v) => !v || v.replace(/[^\dXx]/g, "").length === 0 || isValidRg(v),
        { message: "RG inválido" },
      ),
    endereco_residencial: z.string().trim().max(300).optional(),
    cidade_cliente: z.string().trim().max(100).optional(),
    estado_cliente: z.string().trim().max(50).optional(),

    // ── Acesso ──
    // FIX: password only required when create_user is true
    customer_password: z.string().max(72).optional(),
    create_user: z.boolean(),
  })
  .refine(
    (data) => {
      // Password validation only when create_user is enabled
      if (data.create_user) {
        return !!data.customer_password && data.customer_password.length >= 6;
      }
      return true;
    },
    {
      message: "Senha deve ter no mínimo 6 caracteres",
      path: ["customer_password"],
    },
  )
  .refine(
    (data) => {
      if (!data.is_project_phase) {
        return !!data.planned_start_date && !!data.planned_end_date;
      }
      return true;
    },
    {
      message:
        "Datas de início e término são obrigatórias para obras em execução",
      path: ["planned_start_date"],
    },
  );

export interface FormData {
  // Obra / Imóvel
  name: string;
  unit_name: string;
  nome_do_empreendimento: string;
  address: string;
  bairro: string;
  cep: string;
  complemento: string;
  cidade_imovel: string;
  tamanho_imovel_m2: string;
  tipo_de_locacao: string;
  data_recebimento_chaves: string;
  is_project_phase: boolean;

  // Cronograma
  planned_start_date: string;
  planned_end_date: string;
  business_days_duration: string;
  contract_signing_date: string;

  // Comercial / Financeiro
  contract_value: string;
  num_installments: string;
  installment_value: string;
  payment_method: string;
  payment_status: string;
  contract_signed_at: string;
  commercial_notes: string;
  contract_document_name: string;
  budget_uploaded: boolean;
  budget_file_name: string;

  // Contratante
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  nacionalidade: string;
  estado_civil: string;
  profissao: string;
  cpf: string;
  rg: string;
  endereco_residencial: string;
  cidade_cliente: string;
  estado_cliente: string;

  // Acesso
  customer_password: string;
  create_user: boolean;
}

export const initialFormData: FormData = {
  name: "",
  unit_name: "",
  nome_do_empreendimento: "",
  address: "",
  bairro: "",
  cep: "",
  complemento: "",
  cidade_imovel: "",
  tamanho_imovel_m2: "",
  tipo_de_locacao: "",
  data_recebimento_chaves: "",
  is_project_phase: false,

  planned_start_date: "",
  planned_end_date: "",
  business_days_duration: "",
  contract_signing_date: "",

  contract_value: "",
  num_installments: "",
  installment_value: "",
  payment_method: "",
  payment_status: "pending",
  contract_signed_at: "",
  commercial_notes: "",
  contract_document_name: "",
  budget_uploaded: false,
  budget_file_name: "",

  customer_name: "",
  customer_email: "",
  customer_phone: "",
  nacionalidade: "",
  estado_civil: "",
  profissao: "",
  cpf: "",
  rg: "",
  endereco_residencial: "",
  cidade_cliente: "",
  estado_cliente: "",

  customer_password: "",
  create_user: true,
};

// ── Contract AI Import Types ──

export type ContractParseStatus =
  | "idle"
  | "uploading"
  | "parsing"
  | "success"
  | "error";

export interface ContractConflict {
  field: string;
  values: string[];
  reason: string;
}

export interface ContractParseResult {
  customer: Record<string, string | null>;
  studio: Record<string, string | null>;
  commercial: Record<string, unknown>;
  project: Record<string, string | null>;
  confidence: Record<string, number>;
  conflicts: ContractConflict[];
  missing_fields: string[];
}

export interface ContractImportState {
  file: File | null;
  parseStatus: ContractParseStatus;
  parseResult: ContractParseResult | null;
  errorMessage: string;
  aiPrefilledFields: Set<string>;
  aiConflicts: ContractConflict[];
  aiMissingFields: string[];
  aiSourceDocumentName: string;
  aiLastAppliedAt: string | null;
}

export const initialContractImportState: ContractImportState = {
  file: null,
  parseStatus: "idle",
  parseResult: null,
  errorMessage: "",
  aiPrefilledFields: new Set(),
  aiConflicts: [],
  aiMissingFields: [],
  aiSourceDocumentName: "",
  aiLastAppliedAt: null,
};
