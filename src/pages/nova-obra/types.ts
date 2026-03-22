import { z } from 'zod';

export const formSchema = z.object({
  name: z.string().trim().min(1, 'Condomínio é obrigatório').max(200),
  unit_name: z.string().trim().max(100).optional(),
  address: z.string().trim().max(300).optional(),
  bairro: z.string().trim().max(100).optional(),
  cep: z.string().trim().max(10).optional(),
  planned_start_date: z.string().optional(),
  planned_end_date: z.string().optional(),
  contract_signing_date: z.string().optional(),
  contract_value: z.string().optional(),
  num_installments: z.string().optional(),
  installment_value: z.string().optional(),
  payment_method: z.string().optional(),
  payment_status: z.string().optional(),
  customer_name: z.string().trim().min(1, 'Nome do cliente é obrigatório').max(200),
  customer_email: z.string().trim().email('E-mail inválido').max(255),
  customer_phone: z.string().trim().max(20).optional(),
  customer_password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(72),
  is_project_phase: z.boolean(),
  create_user: z.boolean(),
}).refine((data) => {
  if (!data.is_project_phase) {
    return !!data.planned_start_date && !!data.planned_end_date;
  }
  return true;
}, {
  message: 'Datas de início e término são obrigatórias para obras em execução',
  path: ['planned_start_date'],
});

export interface FormData {
  name: string;
  unit_name: string;
  address: string;
  bairro: string;
  cep: string;
  planned_start_date: string;
  planned_end_date: string;
  contract_signing_date: string;
  contract_value: string;
  num_installments: string;
  installment_value: string;
  payment_method: string;
  payment_status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_password: string;
  is_project_phase: boolean;
  create_user: boolean;
}

export const initialFormData: FormData = {
  name: '',
  unit_name: '',
  address: '',
  bairro: '',
  cep: '',
  planned_start_date: '',
  planned_end_date: '',
  contract_signing_date: '',
  contract_value: '',
  num_installments: '',
  installment_value: '',
  payment_method: '',
  payment_status: 'pending',
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  customer_password: '',
  is_project_phase: false,
  create_user: true,
};
