export interface Project {
  id: string;
  name: string;
  unit_name: string | null;
  address: string | null;
  bairro: string | null;
  cep: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  contract_value: number | null;
  status: string;
  is_project_phase: boolean;
  date_briefing_arch: string | null;
  date_approval_3d: string | null;
  date_approval_exec: string | null;
  date_approval_obra: string | null;
  date_official_start: string | null;
  date_official_delivery: string | null;
  date_mobilization_start: string | null;
  contract_signing_date: string | null;
}

export interface Customer {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_user_id: string | null;
  invitation_sent_at: string | null;
  invitation_accepted_at: string | null;
}

export interface Activity {
  id: string;
  description: string;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  weight: number;
  sort_order: number;
  etapa: string | null;
  detailed_description: string | null;
}

export interface Payment {
  id: string;
  installment_number: number;
  description: string;
  amount: number;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
}

export interface Engineer {
  id: string;
  engineer_user_id: string;
  is_primary: boolean;
  display_name?: string;
  email?: string;
}

export interface AvailableEngineer {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string;
}
