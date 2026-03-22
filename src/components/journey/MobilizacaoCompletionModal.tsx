import { useState, useEffect } from 'react';
import { Loader2, Calendar, ArrowRight, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { projectsRepo } from '@/infra/repositories';
import { useAuth } from '@/hooks/useAuth';
import { useCompleteStage } from '@/hooks/useProjectJourney';
import { addBusinessDays } from '@/lib/businessDays';
import { useQueryClient } from '@tanstack/react-query';

interface MobilizacaoCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageId: string;
  projectId: string;
  onSuccess?: () => void;
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function MobilizacaoCompletionModal({
  open,
  onOpenChange,
  stageId,
  projectId,
  onSuccess,
}: MobilizacaoCompletionModalProps) {
  const { user } = useAuth();
  const completeStage = useCompleteStage();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [projectData, setProjectData] = useState<{
    name: string;
    unit_name: string | null;
    address: string | null;
    bairro: string | null;
    cep: string | null;
    contract_value: number | null;
    org_id: string | null;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    milestoneDates: {
      contract_signing_date: string | null;
      date_briefing_arch: string | null;
      date_approval_3d: string | null;
      date_approval_exec: string | null;
      date_approval_obra: string | null;
      date_mobilization_start: string | null;
    };
  } | null>(null);

  // Load project data when modal opens
  useEffect(() => {
    if (!open || !projectId) return;

    const defaultDate = addBusinessDays(new Date(), 5);
    setPlannedStartDate(formatDateForInput(defaultDate));

    (async () => {
      const [projectRes, customerRes, stagesRes] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('project_customers').select('*').eq('project_id', projectId).limit(1),
        supabase.from('journey_stages').select('name, confirmed_end, sort_order').eq('project_id', projectId).order('sort_order'),
      ]);

      if (projectRes.data) {
        const customer = customerRes.data?.[0];

        // Map journey stage completion dates to project milestone columns
        const stages = stagesRes.data ?? [];
        const stageMap = new Map(stages.map(s => [s.name.toLowerCase(), s.confirmed_end]));

        const milestoneDates = {
          contract_signing_date: projectRes.data.contract_signing_date ?? stageMap.get('boas-vindas') ?? null,
          date_briefing_arch: stageMap.get('briefing arquitetônico') ?? null,
          date_approval_3d: stageMap.get('projeto 3d') ?? null,
          date_approval_exec: stageMap.get('projeto executivo') ?? null,
          date_approval_obra: stageMap.get('liberação da obra') ?? null,
          date_mobilization_start: stageMap.get('mobilização') ?? null,
        };

        setProjectData({
          name: projectRes.data.name,
          unit_name: projectRes.data.unit_name,
          address: projectRes.data.address,
          bairro: (projectRes.data as any).bairro,
          cep: (projectRes.data as any).cep,
          contract_value: projectRes.data.contract_value,
          org_id: projectRes.data.org_id,
          customer_name: customer?.customer_name || '',
          customer_email: customer?.customer_email || '',
          customer_phone: customer?.customer_phone || null,
          milestoneDates,
        });
      }
    })();
  }, [open, projectId]);

  const handleConfirm = async () => {
    if (!user || !projectData || !plannedStartDate) return;

    setLoading(true);

    try {
      // 1. Complete the Mobilização stage
      await completeStage.mutateAsync({ stageId, projectId });

      // 2. Create the new construction project (NOT project phase)
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: projectData.name,
          unit_name: projectData.unit_name,
          address: projectData.address,
          bairro: projectData.bairro,
          cep: projectData.cep,
          contract_value: projectData.contract_value,
          org_id: projectData.org_id,
          planned_start_date: plannedStartDate,
          status: 'active',
          created_by: user.id,
          is_project_phase: false,
          contract_signing_date: projectData.milestoneDates.contract_signing_date,
          date_briefing_arch: projectData.milestoneDates.date_briefing_arch,
          date_approval_3d: projectData.milestoneDates.date_approval_3d,
          date_approval_exec: projectData.milestoneDates.date_approval_exec,
          date_approval_obra: projectData.milestoneDates.date_approval_obra,
          date_mobilization_start: projectData.milestoneDates.date_mobilization_start,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // 3. Copy project members
      const { data: members } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId);

      if (members && members.length > 0) {
        await supabase.from('project_members').insert(
          members.map((m) => ({
            project_id: newProject.id,
            user_id: m.user_id,
            role: m.role,
          })),
        );
      }

      // 4. Copy project engineers
      const { data: engineers } = await supabase
        .from('project_engineers')
        .select('*')
        .eq('project_id', projectId);

      if (engineers && engineers.length > 0) {
        await supabase.from('project_engineers').insert(
          engineers.map((e) => ({
            project_id: newProject.id,
            engineer_user_id: e.engineer_user_id,
            is_primary: e.is_primary,
          })),
        );
      }

      // 5. Copy customer
      await supabase.from('project_customers').insert({
        project_id: newProject.id,
        customer_name: projectData.customer_name,
        customer_email: projectData.customer_email,
        customer_phone: projectData.customer_phone,
      });

      // 6. Copy payments (financeiro)
      const { data: payments } = await supabase
        .from('project_payments')
        .select('*')
        .eq('project_id', projectId);

      if (payments && payments.length > 0) {
        await supabase.from('project_payments').insert(
          payments.map((p) => ({
            project_id: newProject.id,
            installment_number: p.installment_number,
            description: p.description,
            amount: p.amount,
            due_date: p.due_date,
            paid_at: p.paid_at,
            boleto_path: p.boleto_path,
            payment_method: p.payment_method,
            payment_proof_path: p.payment_proof_path,
          })),
        );
      }

      // 7. Copy documents
      const { data: documents } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId);

      if (documents && documents.length > 0) {
        await supabase.from('project_documents').insert(
          documents.map((d) => ({
            project_id: newProject.id,
            document_type: d.document_type,
            name: d.name,
            storage_path: d.storage_path,
            storage_bucket: d.storage_bucket,
            mime_type: d.mime_type,
            size_bytes: d.size_bytes,
            status: d.status,
            description: d.description,
            uploaded_by: d.uploaded_by,
            version: d.version,
            checksum: d.checksum,
          })),
        );
      }

      // 8. Copy formalizations (update project_id to new project)
      const { data: formalizations } = await supabase
        .from('formalizations')
        .select('id')
        .eq('project_id', projectId);

      if (formalizations && formalizations.length > 0) {
        // Update formalizations to point to the new project
        await supabase
          .from('formalizations')
          .update({ project_id: newProject.id })
          .eq('project_id', projectId);
      }

      // 9. Copy pending items
      const { data: pendingItems } = await supabase
        .from('pending_items')
        .select('*')
        .eq('project_id', projectId);

      if (pendingItems && pendingItems.length > 0) {
        await supabase.from('pending_items').insert(
          pendingItems.map((pi) => ({
            project_id: newProject.id,
            customer_org_id: pi.customer_org_id,
            title: pi.title,
            type: pi.type,
            description: pi.description,
            due_date: pi.due_date,
            status: pi.status,
            impact: pi.impact,
            amount: pi.amount,
            options: pi.options,
            action_url: pi.action_url,
            reference_id: pi.reference_id,
            reference_type: pi.reference_type,
            resolution_notes: pi.resolution_notes,
            resolution_payload: pi.resolution_payload,
            resolved_at: pi.resolved_at,
            resolved_by: pi.resolved_by,
          })),
        );
      }

      // 10. Copy activities (cronograma)
      const { data: activities } = await supabase
        .from('project_activities')
        .select('*')
        .eq('project_id', projectId);

      if (activities && activities.length > 0) {
        await supabase.from('project_activities').insert(
          activities.map((a) => ({
            project_id: newProject.id,
            description: a.description,
            planned_start: a.planned_start,
            planned_end: a.planned_end,
            actual_start: a.actual_start,
            actual_end: a.actual_end,
            weight: a.weight,
            sort_order: a.sort_order,
            created_by: a.created_by,
            predecessor_ids: [], // reset predecessors since IDs change
            baseline_start: a.baseline_start,
            baseline_end: a.baseline_end,
            baseline_saved_at: a.baseline_saved_at,
          })),
        );
      }

      // 11. Copy purchases (compras)
      const { data: purchases } = await supabase
        .from('project_purchases')
        .select('*')
        .eq('project_id', projectId);

      if (purchases && purchases.length > 0) {
        await supabase.from('project_purchases').insert(
          purchases.map((p) => ({
            project_id: newProject.id,
            item_name: p.item_name,
            description: p.description,
            quantity: p.quantity,
            unit: p.unit,
            estimated_cost: p.estimated_cost,
            lead_time_days: p.lead_time_days,
            required_by_date: p.required_by_date,
            order_date: p.order_date,
            expected_delivery_date: p.expected_delivery_date,
            actual_delivery_date: p.actual_delivery_date,
            supplier_name: p.supplier_name,
            supplier_contact: p.supplier_contact,
            invoice_number: p.invoice_number,
            status: p.status,
            notes: p.notes,
            created_by: p.created_by,
          })),
        );
      }

      // 12. Copy team contacts
      const { data: teamContacts } = await supabase
        .from('project_team_contacts')
        .select('*')
        .eq('project_id', projectId);

      if (teamContacts && teamContacts.length > 0) {
        await supabase.from('project_team_contacts').insert(
          teamContacts.map((tc) => ({
            project_id: newProject.id,
            display_name: tc.display_name,
            role_type: tc.role_type,
            phone: tc.phone,
            email: tc.email,
            photo_url: tc.photo_url,
            crea: tc.crea,
          })),
        );
      }

      // 13. Copy 3D versions and images
      const { data: versions3d } = await supabase
        .from('project_3d_versions')
        .select('*, project_3d_images(*)')
        .eq('project_id', projectId);

      if (versions3d && versions3d.length > 0) {
        for (const v of versions3d) {
          const { data: newVersion } = await supabase
            .from('project_3d_versions')
            .insert({
              project_id: newProject.id,
              version_number: v.version_number,
              created_by: v.created_by,
              stage_key: v.stage_key,
            })
            .select()
            .single();

          if (newVersion && v.project_3d_images?.length > 0) {
            await supabase.from('project_3d_images').insert(
              v.project_3d_images.map((img: any) => ({
                version_id: newVersion.id,
                storage_path: img.storage_path,
                sort_order: img.sort_order,
              })),
            );
          }
        }
      }

      // 14. Copy member permissions
      const { data: permissions } = await supabase
        .from('project_member_permissions')
        .select('*')
        .eq('project_id', projectId);

      if (permissions && permissions.length > 0) {
        await supabase.from('project_member_permissions').insert(
          permissions.map((p) => ({
            project_id: newProject.id,
            user_id: p.user_id,
            permission: p.permission,
            granted: p.granted,
            granted_by: p.granted_by,
          })),
        );
      }

      // 15. Mark original journey project as completed
      await supabase
        .from('projects')
        .update({ status: 'completed' })
        .eq('id', projectId);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['staff-projects'] });

      toast.success('Obra de acompanhamento criada com sucesso!', {
        description: `A obra "${projectData.name}" está pronta para acompanhamento.`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error('Error creating construction project:', err);
      toast.error('Erro ao criar obra de acompanhamento', {
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Concluir Mobilização
          </DialogTitle>
          <DialogDescription>
            Ao concluir esta etapa, uma nova obra de acompanhamento será criada com os dados do cliente e empreendimento. 
            Documentos, financeiro, formalizações e pendências serão mantidos.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="space-y-4 py-2">
          {/* Project info summary */}
          {projectData && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
              <p className="text-sm font-medium">{projectData.name}</p>
              {projectData.unit_name && (
                <p className="text-xs text-muted-foreground">{projectData.unit_name}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Cliente: {projectData.customer_name}
              </p>
            </div>
          )}

          {/* Start date picker */}
          <div className="space-y-2">
            <Label htmlFor="mob-start-date" className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Data de início da obra *
            </Label>
            <Input
              id="mob-start-date"
              type="date"
              value={plannedStartDate}
              onChange={(e) => setPlannedStartDate(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Sugestão: 5 dias úteis após a conclusão da liberação da obra.
            </p>
          </div>

          {/* What will be copied */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              O que será mantido na nova obra:
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                'Dados do cliente',
                'Dados do empreendimento',
                'Cronograma (atividades)',
                'Financeiro (parcelas)',
                'Documentos',
                'Formalizações',
                'Pendências',
                'Compras',
                'Equipe do projeto',
                'Projeto 3D',
                'Marcos do projeto',
              ].map((item) => (
                <div key={item} className="flex items-center gap-1.5 text-xs text-foreground">
                  <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="min-h-[44px]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !plannedStartDate}
            className="min-h-[44px] gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando obra...
              </>
            ) : (
              <>
                Concluir e criar obra
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
