/**
 * Projects Repository
 *
 * Centralized data access for projects.
 * Handles all Supabase interactions for the projects feature.
 */

import {
  supabase,
  executeQuery,
  executeListQuery,
  type RepositoryResult,
  type RepositoryListResult,
} from "./base.repository";
import type { Database } from "@/integrations/supabase/types";

// ============================================================================
// Types
// ============================================================================

export type ProjectStatus =
  | "draft"
  | "active"
  | "completed"
  | "paused"
  | "cancelled";

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
  status: ProjectStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  org_id: string | null;
  is_project_phase?: boolean;
  contract_signing_date?: string | null;
}

export interface ProjectWithCustomer extends Project {
  customer_name?: string;
  customer_email?: string;
  engineer_name?: string;
  engineer_user_id?: string;
  // Studio info (enriched from project_studio_info)
  tamanho_imovel_m2?: number | null;
  endereco_completo?: string | null;
  cidade?: string | null;
  tipo_de_locacao?: string | null;
  data_recebimento_chaves?: string | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  org_id: string | null;
  org_name: string | null;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string | null;
  actual_end_date: string | null;
  contract_value: number | null;
  user_role: string;
  pending_count: number;
  overdue_count: number;
  unsigned_formalizations: number;
  pending_documents: number;
  progress_percentage: number;
  last_activity_at: string | null;
  is_project_phase: boolean;
}

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * Fetch all projects for staff users
 */
export async function getStaffProjects(): Promise<
  RepositoryListResult<ProjectWithCustomer>
> {
  return executeListQuery(async () => {
    // Fetch projects with customers
    const { data: projectsData, error: projectsError } = await supabase
      .from("projects")
      .select(
        `
        *,
        project_customers (
          customer_name,
          customer_email
        )
      `,
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (projectsError) return { data: null, error: projectsError };

    // Fetch all project engineers with their profile names
    const { data: engineersData, error: engineersError } = await supabase
      .from("project_engineers")
      .select("project_id, engineer_user_id, is_primary");

    if (engineersError) return { data: null, error: engineersError };

    // Get unique engineer user IDs and fetch their profiles
    const engineerUserIds = [
      ...new Set(engineersData?.map((e) => e.engineer_user_id) ?? []),
    ];

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", engineerUserIds);

    // Create a map of user_id -> display_name
    const profileMap = new Map(
      profilesData?.map((p) => [p.user_id, p.display_name]) ?? [],
    );

    // Create a map of project_id -> primary engineer info
    const projectEngineerMap = new Map<
      string,
      { engineer_user_id: string; engineer_name: string | null }
    >();

    for (const engineer of engineersData ?? []) {
      const existing = projectEngineerMap.get(engineer.project_id);
      // Only set if we don't have one yet or this one is primary
      if (!existing || engineer.is_primary) {
        projectEngineerMap.set(engineer.project_id, {
          engineer_user_id: engineer.engineer_user_id,
          engineer_name: profileMap.get(engineer.engineer_user_id) ?? null,
        });
      }
    }

    // Fetch studio info for all projects
    const projectIds = (projectsData ?? []).map((p) => p.id);
    const { data: studioData } = await supabase
      .from("project_studio_info")
      .select(
        "project_id, tamanho_imovel_m2, endereco_completo, cidade, tipo_de_locacao, data_recebimento_chaves",
      )
      .in("project_id", projectIds);

    const studioMap = new Map((studioData ?? []).map((s) => [s.project_id, s]));

    return {
      data: (projectsData ?? []).map((p) => {
        const engineerInfo = projectEngineerMap.get(p.id);
        const studio = studioMap.get(p.id);
        return {
          ...p,
          status: p.status as ProjectStatus,
          customer_name: p.project_customers?.[0]?.customer_name,
          customer_email: p.project_customers?.[0]?.customer_email,
          engineer_name: engineerInfo?.engineer_name ?? undefined,
          engineer_user_id: engineerInfo?.engineer_user_id ?? undefined,
          tamanho_imovel_m2: studio?.tamanho_imovel_m2 ?? null,
          endereco_completo: studio?.endereco_completo ?? null,
          cidade: studio?.cidade ?? null,
          tipo_de_locacao: studio?.tipo_de_locacao ?? null,
          data_recebimento_chaves: studio?.data_recebimento_chaves ?? null,
        };
      }),
      error: null,
    };
  });
}

/**
 * Fetch projects for a specific customer
 * Checks both project_members (unified) and project_customers (legacy) tables
 */
export async function getCustomerProjects(
  userId: string,
): Promise<RepositoryListResult<Project>> {
  return executeListQuery(async () => {
    // Fetch from unified membership table
    const { data: memberData, error: memberError } = await supabase
      .from("project_members")
      .select(
        `
        project:projects (*)
      `,
      )
      .eq("user_id", userId);

    if (memberError) return { data: null, error: memberError };

    // Fetch from legacy project_customers table for backwards compatibility
    const { data: customerData, error: customerError } = await supabase
      .from("project_customers")
      .select(
        `
        project:projects (*)
      `,
      )
      .eq("customer_user_id", userId);

    if (customerError) return { data: null, error: customerError };

    // Combine and deduplicate projects from both sources
    const memberProjects = (memberData ?? [])
      .map((pm) => pm.project)
      .filter((p): p is NonNullable<typeof p> => p !== null);

    const customerProjects = (customerData ?? [])
      .map((pc) => pc.project)
      .filter((p): p is NonNullable<typeof p> => p !== null);

    const allProjects = [...memberProjects, ...customerProjects].filter(
      (p): p is NonNullable<typeof p> =>
        p != null && (p as { deleted_at?: string | null }).deleted_at == null,
    );
    const uniqueProjects = allProjects.filter(
      (p, index, self) => index === self.findIndex((t) => t.id === p.id),
    );

    return {
      data: uniqueProjects.map((p) => ({
        ...p,
        status: p.status as ProjectStatus,
      })),
      error: null,
    };
  });
}

/**
 * Fetch a single project by ID
 */
export async function getProjectById(
  projectId: string,
): Promise<RepositoryResult<Project>> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { data: null, error };

    return {
      data: data ? { ...data, status: data.status as ProjectStatus } : null,
      error: null,
    };
  });
}

/**
 * Fetch project summary using optimized RPC
 */
export async function getUserProjectsSummary(): Promise<
  RepositoryListResult<ProjectSummary>
> {
  return executeListQuery(async () => {
    const { data, error } = await supabase.rpc("get_user_projects_summary");
    return { data: (data as unknown as ProjectSummary[]) ?? null, error };
  });
}

/**
 * Check if user has access to a project
 */
export async function checkProjectAccess(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_project_access", {
    _user_id: userId,
    _project_id: projectId,
  });

  if (error) {
    console.error("Error checking project access:", error);
    return false;
  }

  return !!data;
}

/**
 * Delete a project by ID
 */
export async function deleteProject(
  projectId: string,
): Promise<RepositoryResult<null>> {
  return executeQuery(async () => {
    const { error } = await supabase.rpc("soft_delete_project", {
      p_project_id: projectId,
    });
    return { data: null, error };
  });
}

/**
 * Restore a soft-deleted project
 */
export async function restoreProject(
  projectId: string,
): Promise<RepositoryResult<null>> {
  return executeQuery(async () => {
    const { error } = await supabase.rpc("restore_project", {
      p_project_id: projectId,
    });
    return { data: null, error };
  });
}

/**
 * Permanently delete a soft-deleted project (admin only)
 */
export async function hardDeleteProject(
  projectId: string,
): Promise<RepositoryResult<null>> {
  return executeQuery(async () => {
    const { error } = await supabase.rpc("hard_delete_project", {
      p_project_id: projectId,
    });
    return { data: null, error };
  });
}

/**
 * Fetch soft-deleted projects (trash)
 */
export async function getDeletedProjects(): Promise<
  RepositoryListResult<ProjectWithCustomer>
> {
  return executeListQuery(async () => {
    const { data: projectsData, error } = await supabase
      .from("projects")
      .select(
        `
        *,
        project_customers (customer_name, customer_email)
      `,
      )
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    if (error) return { data: null, error };

    return {
      data: (projectsData ?? []).map((p) => ({
        ...p,
        status: p.status as ProjectStatus,
        customer_name: p.project_customers?.[0]?.customer_name,
        customer_email: p.project_customers?.[0]?.customer_email,
      })),
      error: null,
    };
  });
}

/**
 * Create a new project with customer and engineer
 */
export async function createProjectWithCustomer(input: {
  name: string;
  unit_name?: string | null;
  address?: string | null;
  planned_start_date: string;
  planned_end_date: string;
  contract_value?: number | null;
  created_by: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  invitation_sent_at?: string | null;
}): Promise<RepositoryResult<Project>> {
  return executeQuery(async () => {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        name: input.name,
        unit_name: input.unit_name ?? null,
        address: input.address ?? null,
        planned_start_date: input.planned_start_date,
        planned_end_date: input.planned_end_date,
        contract_value: input.contract_value ?? null,
        created_by: input.created_by,
      })
      .select()
      .single();

    if (projectError) return { data: null, error: projectError };

    // Add creator as engineer (non-critical, log but don't fail)
    const { error: engineerErr } = await supabase
      .from("project_engineers")
      .insert({
        project_id: project.id,
        engineer_user_id: input.created_by,
        is_primary: true,
      });
    if (engineerErr) {
      console.warn(
        "[createProjectWithCustomer] Engineer insert warning:",
        engineerErr.message,
      );
    }

    // Add customer
    const { data: customerInsert } = await supabase
      .from("project_customers")
      .insert({
        project_id: project.id,
        customer_name: input.customer_name,
        customer_email: input.customer_email,
        customer_phone: input.customer_phone ?? null,
        invitation_sent_at: input.invitation_sent_at ?? null,
      })
      .select("customer_user_id")
      .maybeSingle();

    // If customer already has a user account, also add to project_members
    if (customerInsert?.customer_user_id) {
      await supabase.from("project_members").upsert(
        {
          project_id: project.id,
          user_id: customerInsert.customer_user_id,
          role: "viewer" as any,
        },
        { onConflict: "project_id,user_id" },
      );
    }

    return {
      data: { ...project, status: project.status as ProjectStatus },
      error: null,
    };
  });
}

/**
 * Get project data with customer for mobilization completion
 */
export async function getProjectWithCustomerAndStages(projectId: string) {
  const [projectRes, customerRes, stagesRes] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase
      .from("project_customers")
      .select("*")
      .eq("project_id", projectId)
      .limit(1),
    supabase
      .from("journey_stages")
      .select("name, confirmed_end, sort_order")
      .eq("project_id", projectId)
      .order("sort_order"),
  ]);
  return {
    project: projectRes.data,
    customer: customerRes.data?.[0],
    stages: stagesRes.data ?? [],
  };
}

/**
 * Clone a project and all its related data for construction phase
 */
export async function cloneProjectForConstruction(
  sourceProjectId: string,
  newProjectData: Record<string, unknown>,
  createdBy: string,
): Promise<RepositoryResult<Project>> {
  return executeQuery(async () => {
    // 1. Create project
    const { data: newProject, error: projectError } = await supabase
      .from("projects")
      .insert(
        newProjectData as Database["public"]["Tables"]["projects"]["Insert"],
      )
      .select()
      .single();

    if (projectError) return { data: null, error: projectError };

    // 2. Copy members
    const { data: members } = await supabase
      .from("project_members")
      .select("*")
      .eq("project_id", sourceProjectId);
    if (members?.length) {
      await supabase.from("project_members").insert(
        members.map((m) => ({
          project_id: newProject.id,
          user_id: m.user_id,
          role: m.role,
        })),
      );
    }

    // 3. Copy engineers
    const { data: engineers } = await supabase
      .from("project_engineers")
      .select("*")
      .eq("project_id", sourceProjectId);
    if (engineers?.length) {
      await supabase.from("project_engineers").insert(
        engineers.map((e) => ({
          project_id: newProject.id,
          engineer_user_id: e.engineer_user_id,
          is_primary: e.is_primary,
        })),
      );
    }

    // 4. Copy customer
    const { data: customers } = await supabase
      .from("project_customers")
      .select("*")
      .eq("project_id", sourceProjectId)
      .limit(1);
    if (customers?.length) {
      await supabase.from("project_customers").insert({
        project_id: newProject.id,
        customer_name: customers[0].customer_name,
        customer_email: customers[0].customer_email,
        customer_phone: customers[0].customer_phone,
      });
    }

    // 5. Copy payments
    const { data: payments } = await supabase
      .from("project_payments")
      .select("*")
      .eq("project_id", sourceProjectId);
    if (payments?.length) {
      await supabase.from("project_payments").insert(
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

    // 6. Copy documents
    const { data: documents } = await supabase
      .from("project_documents")
      .select("*")
      .eq("project_id", sourceProjectId);
    if (documents?.length) {
      await supabase.from("project_documents").insert(
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

    // 7. Copy formalizations (clone, NOT move — moving would corrupt the source project)
    const { data: formalizations } = await supabase
      .from("formalizations")
      .select("*")
      .eq("project_id", sourceProjectId);
    if (formalizations?.length) {
      for (const f of formalizations) {
        await supabase.from("formalizations").insert({
          customer_org_id: f.customer_org_id,
          created_by: f.created_by,
          type: f.type,
          status: f.status,
          title: f.title,
          summary: f.summary,
          body_md: f.body_md,
          data: f.data,
          project_id: newProject.id,
          unit_id: f.unit_id,
        });
      }
    }

    // 8. Copy pending items
    const { data: pendingItems } = await supabase
      .from("pending_items")
      .select("*")
      .eq("project_id", sourceProjectId);
    if (pendingItems?.length) {
      await supabase.from("pending_items").insert(
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

    // 9. Copy activities
    const { data: activities } = await supabase
      .from("project_activities")
      .select("*")
      .eq("project_id", sourceProjectId);
    if (activities?.length) {
      await supabase.from("project_activities").insert(
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
          predecessor_ids: [],
          baseline_start: a.baseline_start,
          baseline_end: a.baseline_end,
          baseline_saved_at: a.baseline_saved_at,
        })),
      );
    }

    // 10. Copy purchases
    const { data: purchases } = await supabase
      .from("project_purchases")
      .select("*")
      .eq("project_id", sourceProjectId);
    if (purchases?.length) {
      await supabase.from("project_purchases").insert(
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

    // 11. Copy team contacts
    const { data: teamContacts } = await supabase
      .from("project_team_contacts")
      .select("*")
      .eq("project_id", sourceProjectId);
    if (teamContacts?.length) {
      await supabase.from("project_team_contacts").insert(
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

    // 12. Copy 3D versions and images
    const { data: versions3d } = await supabase
      .from("project_3d_versions")
      .select("*, project_3d_images(*)")
      .eq("project_id", sourceProjectId);
    if (versions3d?.length) {
      for (const v of versions3d) {
        const { data: newVersion } = await supabase
          .from("project_3d_versions")
          .insert({
            project_id: newProject.id,
            version_number: v.version_number,
            created_by: v.created_by,
            stage_key: v.stage_key,
          })
          .select()
          .single();
        if (newVersion && v.project_3d_images?.length > 0) {
          await supabase.from("project_3d_images").insert(
            v.project_3d_images.map((img: any) => ({
              version_id: newVersion.id,
              storage_path: img.storage_path,
              sort_order: img.sort_order,
            })),
          );
        }
      }
    }

    // 13. Copy member permissions
    const { data: permissions } = await supabase
      .from("project_member_permissions")
      .select("*")
      .eq("project_id", sourceProjectId);
    if (permissions?.length) {
      await supabase.from("project_member_permissions").insert(
        permissions.map((p) => ({
          project_id: newProject.id,
          user_id: p.user_id,
          permission: p.permission,
          granted: p.granted,
          granted_by: p.granted_by,
        })),
      );
    }

    // 14. Mark original project as completed
    await supabase
      .from("projects")
      .update({ status: "completed" })
      .eq("id", sourceProjectId);

    return {
      data: { ...newProject, status: newProject.status as ProjectStatus },
      error: null,
    };
  });
}

/**
 * Duplicate a project with selective data copying
 */
export async function duplicateProject(input: {
  source: {
    id: string;
    contract_value?: number | null;
    org_id?: string | null;
  };
  newName: string;
  unitName: string | null;
  address: string | null;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  contractValue: number | null;
  isProjectPhase: boolean;
  orgId: string | null;
  createdBy: string;
  customer: { name: string; email: string; phone: string | null };
  options: {
    includeActivities: boolean;
    includeProgress: boolean;
    includePayments: boolean;
    includeJourney: boolean;
  };
}): Promise<RepositoryResult<Project>> {
  return executeQuery(async () => {
    const { data: newProject, error: projectError } = await supabase
      .from("projects")
      .insert({
        name: input.newName,
        unit_name: input.unitName,
        address: input.address,
        planned_start_date: input.plannedStartDate,
        planned_end_date: input.plannedEndDate,
        contract_value: input.contractValue,
        status: "active" as const,
        created_by: input.createdBy,
        org_id: input.orgId,
        is_project_phase: input.isProjectPhase,
      })
      .select()
      .single();

    if (projectError) return { data: null, error: projectError };

    await supabase.from("project_engineers").insert({
      project_id: newProject.id,
      engineer_user_id: input.createdBy,
      is_primary: true,
    });
    await supabase.from("project_members").insert({
      project_id: newProject.id,
      user_id: input.createdBy,
      role: "owner",
    });
    await supabase.from("project_customers").insert({
      project_id: newProject.id,
      customer_name: input.customer.name,
      customer_email: input.customer.email.toLowerCase(),
      customer_phone: input.customer.phone,
    });

    if (input.options.includeActivities) {
      const { data: activities } = await supabase
        .from("project_activities")
        .select("*")
        .eq("project_id", input.source.id)
        .order("sort_order");
      if (activities?.length) {
        await supabase.from("project_activities").insert(
          activities.map((a, i) => ({
            project_id: newProject.id,
            description: a.description,
            planned_start: a.planned_start,
            planned_end: a.planned_end,
            actual_start: input.options.includeProgress ? a.actual_start : null,
            actual_end: input.options.includeProgress ? a.actual_end : null,
            baseline_start: input.options.includeProgress
              ? a.baseline_start
              : null,
            baseline_end: input.options.includeProgress ? a.baseline_end : null,
            baseline_saved_at: input.options.includeProgress
              ? a.baseline_saved_at
              : null,
            weight: a.weight,
            sort_order: i + 1,
            created_by: input.createdBy,
            predecessor_ids: [],
          })),
        );
      }
    }

    if (input.options.includePayments) {
      const { data: payments } = await supabase
        .from("project_payments")
        .select("*")
        .eq("project_id", input.source.id)
        .order("installment_number");
      if (payments?.length) {
        await supabase.from("project_payments").insert(
          payments.map((p) => ({
            project_id: newProject.id,
            installment_number: p.installment_number,
            description: p.description,
            amount: p.amount,
            due_date: p.due_date,
          })),
        );
      }
    }

    if (input.options.includeJourney) {
      const { error: journeyError } = await supabase.rpc(
        "initialize_project_journey",
        { p_project_id: newProject.id },
      );
      if (journeyError) {
        console.error("Journey initialization error:", journeyError);
      }
    }

    return {
      data: { ...newProject, status: newProject.status as ProjectStatus },
      error: null,
    };
  });
}

/**
 * Get a project with customer info
 */
export async function getProjectWithCustomer(
  projectId: string,
): Promise<RepositoryResult<ProjectWithCustomer>> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from("projects")
      .select(`*, project_customers (customer_name, customer_email)`)
      .eq("id", projectId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { data: null, error };
    if (!data) return { data: null, error: null };

    const customer =
      Array.isArray(data.project_customers) && data.project_customers.length > 0
        ? data.project_customers[0]
        : null;

    return {
      data: {
        ...data,
        status: data.status as ProjectStatus,
        customer_name: customer?.customer_name ?? undefined,
        customer_email: customer?.customer_email ?? undefined,
        is_project_phase: data.is_project_phase,
      },
      error: null,
    };
  });
}

/**
 * Download a file from storage
 */
export async function downloadStorageFile(
  bucket: string,
  path: string,
): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) {
    console.error("Download error:", error);
    return null;
  }
  return data;
}

/**
 * Get file storage paths for a 3D version
 */
export async function get3DFilePaths(
  versionId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("project_3d_images")
    .select("storage_path")
    .eq("version_id", versionId)
    .order("sort_order")
    .limit(1);
  if (error || !data?.length) return null;
  return data[0].storage_path;
}
