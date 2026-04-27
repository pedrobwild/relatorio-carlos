import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { initialFormData, type FormData } from './types';

interface EditProjectData {
  formData: FormData;
  loading: boolean;
  error: string | null;
  projectName: string;
}

/**
 * Loads existing project data and maps it to the NovaObra FormData format
 * for editing draft projects received from integrations.
 */
export function useEditProjectLoader(projectId: string | undefined): EditProjectData {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // Fetch project, customer, and studio info in parallel
        const pid = projectId!;
        const [projectRes, customerRes, studioRes] = await Promise.all([
          supabase.from('projects').select('*').eq('id', pid).single(),
          supabase.from('project_customers').select('*').eq('project_id', pid).maybeSingle(),
          supabase.from('project_studio_info' as any).select('*').eq('project_id', pid).maybeSingle(),
        ]);

        if (projectRes.error) throw new Error(projectRes.error.message);
        const p = projectRes.data;
        if (!p) throw new Error('Projeto não encontrado');

        setProjectName(p.name || '');

        const customer = customerRes.data as any;
        const studio = studioRes.data as any;

        setFormData({
          // Obra / Imóvel
          name: p.name || '',
          unit_name: p.unit_name || '',
          nome_do_empreendimento: studio?.nome_do_empreendimento || '',
          address: p.address || studio?.endereco_completo || '',
          bairro: p.bairro || studio?.bairro || '',
          cep: p.cep || studio?.cep || '',
          complemento: studio?.complemento || '',
          cidade_imovel: p.city || studio?.cidade || '',
          tamanho_imovel_m2: studio?.tamanho_imovel_m2?.toString() || '',
          tipo_de_locacao: studio?.tipo_de_locacao || '',
          data_recebimento_chaves: studio?.data_recebimento_chaves || '',
          is_project_phase: p.is_project_phase || false,

          // Cronograma
          planned_start_date: p.planned_start_date || '',
          planned_end_date: p.planned_end_date || '',
          business_days_duration: '',
          contract_signing_date: p.contract_signing_date || '',

          // Comercial / Financeiro
          contract_value: p.contract_value?.toString() || '',
          num_installments: '',
          installment_value: '',
          payment_method: '',
          payment_status: 'pending',
          contract_signed_at: p.contract_signing_date || '',
          commercial_notes: '',
          contract_document_name: '',
          budget_uploaded: false,
          budget_file_name: '',

          // Contratante
          customer_name: customer?.customer_name || p.client_name || '',
          customer_email: customer?.customer_email || p.client_email || '',
          customer_phone: customer?.customer_phone || p.client_phone || '',
          nacionalidade: customer?.nacionalidade || '',
          estado_civil: customer?.estado_civil || '',
          profissao: customer?.profissao || '',
          cpf: customer?.cpf || '',
          rg: customer?.rg || '',
          endereco_residencial: customer?.endereco_residencial || '',
          cidade_cliente: customer?.cidade || '',
          estado_cliente: customer?.estado || '',

          // Acesso — don't create user when editing
          customer_password: '',
          create_user: false,
        });
      } catch (err) {
        console.error('Error loading project for edit:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar projeto');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [projectId]);

  return { formData, loading, error, projectName };
}
