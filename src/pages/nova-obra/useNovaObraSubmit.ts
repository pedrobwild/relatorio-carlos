import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { projectKeys } from '@/hooks/useProjectsQuery';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { addBusinessDays, isWeekend } from '@/lib/businessDays';
import type { ProjectTemplate, TemplateActivity } from '@/hooks/useProjectTemplates';
import type { FormData } from './types';
import type { ScheduleActivity } from './ScheduleCard';

export function useNovaObraSubmit() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submit = async (
    formData: FormData,
    selectedTemplate: ProjectTemplate | null,
    sendInvite: boolean,
    budgetFile?: File | null,
    manualActivities?: ScheduleActivity[],
    contractFile?: File,
  ) => {
    if (!user) throw new Error('Você precisa estar logado');

    // 0. Create user account if enabled
    let createdUserId: string | null = null;
    if (formData.create_user) {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            email: formData.customer_email.trim().toLowerCase(),
            password: formData.customer_password,
            display_name: formData.customer_name.trim(),
            role: 'customer',
          }),
        }
      );
      const userResult = await response.json();
      if (!response.ok) throw new Error(userResult.error || 'Falha ao criar usuário');
      createdUserId = userResult.user?.id || null;
      if (userResult.already_existed) {
        toast({
          title: 'Usuário já existente',
          description: `O e-mail ${formData.customer_email} já possui cadastro. Vinculando ao projeto.`,
        });
      }
    }

    // 1. Create project
    const projectId = crypto.randomUUID();
    const { error: projectError } = await supabase
      .from('projects')
      .insert({
        id: projectId,
        name: formData.name.trim(),
        unit_name: formData.unit_name.trim() || null,
        address: formData.address.trim() || null,
        bairro: formData.bairro.trim() || null,
        cep: formData.cep.trim() || null,
        planned_start_date: formData.planned_start_date || null,
        planned_end_date: formData.planned_end_date || null,
        contract_signing_date: formData.contract_signed_at || formData.contract_signing_date || null,
        contract_value: formData.contract_value ? parseFloat(formData.contract_value) : null,
        created_by: user.id,
        is_project_phase: formData.is_project_phase,
      });

    if (projectError) throw new Error('Falha ao criar projeto: ' + projectError.message);

    const project = {
      id: projectId,
      name: formData.name.trim(),
      unit_name: formData.unit_name.trim() || null,
      address: formData.address.trim() || null,
      bairro: formData.bairro.trim() || null,
      cep: formData.cep.trim() || null,
      planned_start_date: formData.planned_start_date || null,
      planned_end_date: formData.planned_end_date || null,
      contract_signing_date: formData.contract_signed_at || formData.contract_signing_date || null,
      contract_value: formData.contract_value ? parseFloat(formData.contract_value) : null,
      created_by: user.id,
      is_project_phase: formData.is_project_phase,
      // Commercial fields stored in project metadata via payment_method + notes
      // payment_method and commercial_notes are persisted via project_payments and project metadata
    };

    // 2. Add current user as engineer
    const { error: engineerError } = await supabase
      .from('project_engineers')
      .insert({ project_id: project.id, engineer_user_id: user.id, is_primary: true });
    if (engineerError) console.error('Engineer assignment error:', engineerError);

    // 3. Add current user to project_members as owner
    const { error: memberError } = await supabase
      .from('project_members')
      .insert({ project_id: project.id, user_id: user.id, role: 'owner' });
    if (memberError) console.error('Member assignment error:', memberError);

    // 4. Add customer with full contratante data
    const { error: customerError } = await supabase
      .from('project_customers')
      .insert({
        project_id: project.id,
        customer_name: formData.customer_name.trim(),
        customer_email: formData.customer_email.trim().toLowerCase(),
        customer_phone: formData.customer_phone.trim() || null,
        customer_user_id: createdUserId || null,
        invitation_sent_at: sendInvite ? new Date().toISOString() : null,
        nacionalidade: formData.nacionalidade.trim() || null,
        estado_civil: formData.estado_civil.trim() || null,
        profissao: formData.profissao.trim() || null,
        cpf: formData.cpf.trim() || null,
        rg: formData.rg.trim() || null,
        endereco_residencial: formData.endereco_residencial.trim() || null,
        cidade: formData.cidade_cliente.trim() || null,
        estado: formData.estado_cliente.trim() || null,
      });
    if (customerError) console.error('Customer creation error:', customerError);

    // 4b. Persist studio/property info
    const hasStudioData = formData.nome_do_empreendimento || formData.complemento ||
      formData.tamanho_imovel_m2 || formData.tipo_de_locacao || formData.data_recebimento_chaves ||
      formData.cidade_imovel;

    if (hasStudioData) {
      const { error: studioError } = await supabase
        .from('project_studio_info')
        .upsert({
          project_id: project.id,
          nome_do_empreendimento: formData.nome_do_empreendimento.trim() || null,
          endereco_completo: formData.address.trim() || null,
          bairro: formData.bairro.trim() || null,
          cidade: formData.cidade_imovel.trim() || null,
          cep: formData.cep.trim() || null,
          complemento: formData.complemento.trim() || null,
          tamanho_imovel_m2: formData.tamanho_imovel_m2 ? parseFloat(formData.tamanho_imovel_m2) : null,
          tipo_de_locacao: formData.tipo_de_locacao || null,
          data_recebimento_chaves: formData.data_recebimento_chaves || null,
        });
      if (studioError) console.error('Studio info creation error:', studioError);
    }

    // 5. If user was created, add as project member viewer
    if (createdUserId) {
      const { error: viewerError } = await supabase
        .from('project_members')
        .insert({ project_id: project.id, user_id: createdUserId, role: 'viewer' });
      if (viewerError) console.error('Viewer assignment error:', viewerError);
    }

    // 6. Initialize project journey if in project phase
    if (formData.is_project_phase) {
      const { error: journeyError } = await supabase
        .rpc('initialize_project_journey', { p_project_id: project.id });
      if (journeyError) console.error('Journey initialization error:', journeyError);
    }

    // 7. Create activities from template
    if (selectedTemplate && Array.isArray(selectedTemplate.default_activities) && selectedTemplate.default_activities.length > 0) {
      const activities = selectedTemplate.default_activities as { description: string; durationDays: number; weight: number }[];
      const startDate = formData.planned_start_date ? new Date(formData.planned_start_date + 'T00:00:00') : new Date();

      let currentDate = new Date(startDate);
      if (isWeekend(currentDate)) {
        currentDate = addBusinessDays(currentDate, 0);
        currentDate.setDate(currentDate.getDate() + 1);
        while (isWeekend(currentDate)) currentDate.setDate(currentDate.getDate() + 1);
      }

      const activityIds: string[] = [];
      const rows = activities.map((act, idx) => {
        const actId = crypto.randomUUID();
        activityIds.push(actId);
        const actStart = new Date(currentDate);
        const actEnd = addBusinessDays(actStart, act.durationDays - 1);
        currentDate = addBusinessDays(actEnd, 1);
        const fmt = (d: Date) => d.toISOString().split('T')[0];
        return {
          id: actId, project_id: project.id, description: act.description,
          planned_start: fmt(actStart), planned_end: fmt(actEnd),
          weight: act.weight, sort_order: idx, created_by: user!.id,
          predecessor_ids: idx > 0 ? [activityIds[idx - 1]] : [],
        };
      });

      const { error: actError } = await supabase.from('project_activities').insert(rows);
      if (actError) console.error('Activities creation error:', actError);
    } else if (manualActivities && manualActivities.length > 0) {
      const validActivities = manualActivities.filter((a) => a.description.trim());
      if (validActivities.length > 0) {
        const activityIds: string[] = [];
        const rows = validActivities.map((act, idx) => {
          const actId = crypto.randomUUID();
          activityIds.push(actId);
          return {
            id: actId,
            project_id: project.id,
            description: act.description.trim(),
            planned_start: act.plannedStart || formData.planned_start_date || new Date().toISOString().split('T')[0],
            planned_end: act.plannedEnd || formData.planned_end_date || new Date().toISOString().split('T')[0],
            weight: parseFloat(act.weight) || 0,
            sort_order: idx,
            created_by: user!.id,
            predecessor_ids: idx > 0 ? [activityIds[idx - 1]] : [],
          };
        });

        const { error: actError } = await supabase.from('project_activities').insert(rows);
        if (actError) console.error('Manual activities creation error:', actError);
      }
    }

    if (formData.num_installments && parseInt(formData.num_installments) > 0) {
      const numInstallments = parseInt(formData.num_installments);
      const installmentAmount = formData.installment_value
        ? parseFloat(formData.installment_value)
        : (formData.contract_value ? parseFloat(formData.contract_value) / numInstallments : 0);

      const paymentRows = Array.from({ length: numInstallments }, (_, i) => ({
        project_id: project.id,
        installment_number: i + 1,
        description: `Parcela ${i + 1}/${numInstallments}${formData.payment_method ? ` - ${formData.payment_method}` : ''}`,
        amount: installmentAmount,
        due_date: null,
        paid_at: formData.payment_status === 'paid' ? new Date().toISOString() : null,
      }));

      const { error: paymentError } = await supabase.from('project_payments').insert(paymentRows);
      if (paymentError) console.error('Payment creation error:', paymentError);
    }

    // 9. Increment template usage counter
    if (selectedTemplate) {
      const { error: usageError } = await supabase.rpc('increment_template_usage', { p_template_id: selectedTemplate.id });
      if (usageError) console.error('Usage tracking error:', usageError);
    }

    // 10. Upload budget file
    if (budgetFile) {
      const timestamp = Date.now();
      const sanitizedName = budgetFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${project.id}/orcamento/${timestamp}_${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('project-documents')
        .upload(storagePath, budgetFile, { contentType: budgetFile.type, upsert: false });

      if (uploadError) {
        console.error('Budget upload error:', uploadError);
      } else {
        const { error: docError } = await supabase
          .from('project_documents')
          .insert({
            project_id: project.id,
            document_type: 'orcamento',
            name: `Orçamento - ${formData.name.trim()}`,
            storage_path: storagePath,
            storage_bucket: 'project-documents',
            mime_type: budgetFile.type,
            size_bytes: budgetFile.size,
            uploaded_by: user!.id,
            status: 'approved',
            version: 1,
          });
        if (docError) console.error('Budget document record error:', docError);

        // 11. Parse budget to populate purchases
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-budget-purchases`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionData.session?.access_token}`,
              },
              body: JSON.stringify({
                project_id: project.id,
                storage_path: storagePath,
                user_id: user!.id,
              }),
            }
          );
        } catch (parseError) {
          console.error('Budget parsing error:', parseError);
        }
      }
    }

    // 12. Upload contract file if provided
    if (contractFile) {
      const timestamp = Date.now();
      const sanitizedName = contractFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${project.id}/contrato/${timestamp}_${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('project-documents')
        .upload(storagePath, contractFile, { contentType: contractFile.type, upsert: false });

      if (!uploadError) {
        await supabase.from('project_documents').insert({
          project_id: project.id,
          document_type: 'contrato_cliente',
          name: `Contrato - ${formData.customer_name.trim()}`,
          storage_path: storagePath,
          storage_bucket: 'project-documents',
          mime_type: contractFile.type,
          size_bytes: contractFile.size,
          uploaded_by: user!.id,
          status: 'approved',
          version: 1,
        });
      } else {
        console.error('Contract upload error:', uploadError);
      }
    }

    await queryClient.invalidateQueries({ queryKey: projectKeys.all });

    return { project, createdUserId };
  };

  return { submit, user };
}
