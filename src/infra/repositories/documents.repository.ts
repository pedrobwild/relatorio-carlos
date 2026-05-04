/**
 * Documents Repository
 *
 * Centralized data access for project documents.
 * Handles all Supabase interactions for the documents feature.
 */

import {
  supabase,
  executeQuery,
  executeListQuery,
  getPaginationRange,
  type PaginationParams,
  type PaginatedResult,
  type RepositoryResult,
  type RepositoryListResult,
} from "./base.repository";

// ============================================================================
// Types
// ============================================================================

export type DocumentCategory =
  | "contrato"
  | "aditivo"
  | "projeto_3d"
  | "executivo"
  | "art_rrt"
  | "plano_reforma"
  | "nota_fiscal"
  | "garantia"
  | "as_built"
  | "termo_entrega";

export type DocumentStatus = "pending" | "approved";

export interface ProjectDocument {
  id: string;
  project_id: string;
  document_type: DocumentCategory;
  name: string;
  description: string | null;
  storage_path: string;
  storage_bucket: string;
  mime_type: string | null;
  size_bytes: number | null;
  version: number;
  status: DocumentStatus;
  uploaded_by: string;
  approved_at: string | null;
  approved_by: string | null;
  parent_document_id: string | null;
  checksum: string | null;
  created_at: string;
}

export interface DocumentWithUrl extends ProjectDocument {
  url: string | null;
}

export interface CreateDocumentInput {
  project_id: string;
  document_type: DocumentCategory;
  name: string;
  description?: string;
  storage_path: string;
  storage_bucket: string;
  mime_type?: string;
  size_bytes?: number;
  uploaded_by: string;
  parent_document_id?: string;
  checksum?: string;
}

export interface ApproveDocumentInput {
  document_id: string;
  approved_by: string;
}

export interface DocumentComment {
  id: string;
  project_id: string;
  document_id: string;
  version: number;
  user_id: string;
  comment: string;
  page_number: number | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentCommentWithUser extends DocumentComment {
  user_name?: string;
  user_email?: string;
}

export interface CreateCommentInput {
  project_id: string;
  document_id: string;
  version: number;
  comment: string;
  page_number?: number;
}

// ============================================================================
// Constants
// ============================================================================

export const DOCUMENT_CATEGORIES: Record<
  DocumentCategory,
  { label: string; icon: string }
> = {
  contrato: { label: "Contrato", icon: "FileText" },
  aditivo: { label: "Aditivos", icon: "FilePlus" },
  projeto_3d: { label: "Projeto 3D", icon: "Box" },
  executivo: { label: "Projeto Executivo", icon: "Ruler" },
  art_rrt: { label: "ART/RRT", icon: "Award" },
  plano_reforma: { label: "Plano de Reforma", icon: "ClipboardList" },
  nota_fiscal: { label: "Notas Fiscais", icon: "Receipt" },
  garantia: { label: "Garantias", icon: "Shield" },
  as_built: { label: "As Built", icon: "Building" },
  termo_entrega: { label: "Termo de Entrega", icon: "CheckSquare" },
};

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * Fetch all documents for a project
 */
export async function getProjectDocuments(
  projectId: string,
): Promise<RepositoryListResult<ProjectDocument>> {
  return executeListQuery(async () => {
    const { data, error } = await supabase
      .from("project_documents")
      .select("*")
      .eq("project_id", projectId)
      .order("document_type")
      .order("version", { ascending: false });

    return {
      data:
        data?.map((doc) => ({
          ...doc,
          document_type: doc.document_type as DocumentCategory,
          status: doc.status as DocumentStatus,
        })) ?? null,
      error,
    };
  });
}

/**
 * Fetch documents with pagination
 */
export async function getProjectDocumentsPaginated(
  projectId: string,
  params: PaginationParams & { category?: DocumentCategory },
): Promise<PaginatedResult<ProjectDocument>> {
  const { from, to } = getPaginationRange(params);

  let query = supabase
    .from("project_documents")
    .select("*", { count: "exact" })
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.category) {
    query = query.eq("document_type", params.category);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching paginated documents:", error);
    return {
      data: [],
      total: 0,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      hasMore: false,
    };
  }

  const total = count ?? 0;
  const pageSize = params.pageSize ?? 20;
  const page = params.page ?? 1;

  return {
    data: (data ?? []).map((doc) => ({
      ...doc,
      document_type: doc.document_type as DocumentCategory,
      status: doc.status as DocumentStatus,
    })),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

/**
 * Generate signed URLs for multiple documents in parallel
 */
export async function getSignedUrls(
  documents: ProjectDocument[],
): Promise<DocumentWithUrl[]> {
  const urlPromises = documents.map(async (doc) => {
    const { data } = await supabase.storage
      .from(doc.storage_bucket)
      .createSignedUrl(doc.storage_path, SIGNED_URL_EXPIRY_SECONDS);

    return {
      ...doc,
      url: data?.signedUrl ?? null,
    };
  });

  return Promise.all(urlPromises);
}

/**
 * Fetch a single document by ID
 */
export async function getDocumentById(
  documentId: string,
): Promise<RepositoryResult<ProjectDocument>> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from("project_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (error) return { data: null, error };

    return {
      data: data
        ? {
            ...data,
            document_type: data.document_type as DocumentCategory,
            status: data.status as DocumentStatus,
          }
        : null,
      error: null,
    };
  });
}

/**
 * Approve a document
 */
export async function approveDocument(
  input: ApproveDocumentInput,
): Promise<RepositoryResult<ProjectDocument>> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from("project_documents")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: input.approved_by,
      })
      .eq("id", input.document_id)
      .select()
      .single();

    if (error) return { data: null, error };

    return {
      data: data
        ? {
            ...data,
            document_type: data.document_type as DocumentCategory,
            status: data.status as DocumentStatus,
          }
        : null,
      error: null,
    };
  });
}

/**
 * Delete a document and its storage file
 */
export async function deleteDocument(
  documentId: string,
): Promise<RepositoryResult<null>> {
  return executeQuery(async () => {
    // First get the document to know its storage path
    const { data: doc, error: fetchError } = await supabase
      .from("project_documents")
      .select("storage_path, storage_bucket")
      .eq("id", documentId)
      .maybeSingle();

    if (fetchError) return { data: null, error: fetchError };
    if (!doc)
      return {
        data: null,
        error: {
          message: "Documento não encontrado",
          details: "",
          hint: "",
          code: "NOT_FOUND",
        } as unknown as import("@supabase/supabase-js").PostgrestError,
      };

    // Delete from storage (ignore errors — file may already be gone)
    try {
      await supabase.storage
        .from(doc.storage_bucket)
        .remove([doc.storage_path]);
    } catch (storageErr) {
      console.warn(
        "[Documents] Storage delete failed (continuing):",
        storageErr,
      );
    }

    // Delete from database
    const { error } = await supabase
      .from("project_documents")
      .delete()
      .eq("id", documentId);

    return { data: null, error };
  });
}

/**
 * Get version history for a document
 */
export async function getDocumentVersionHistory(
  documentId: string,
  allDocuments: ProjectDocument[],
): Promise<ProjectDocument[]> {
  const doc = allDocuments.find((d) => d.id === documentId);
  if (!doc) return [];

  const rootId = doc.parent_document_id || doc.id;
  return allDocuments
    .filter((d) => d.id === rootId || d.parent_document_id === rootId)
    .sort((a, b) => b.version - a.version);
}

/**
 * Get latest version of each document by category
 */
export function getLatestDocumentsByCategory(
  documents: ProjectDocument[],
  category: DocumentCategory,
): ProjectDocument[] {
  const categoryDocs = documents.filter(
    (doc) => doc.document_type === category,
  );

  // Get the latest version of each unique document
  const latestDocs = categoryDocs.reduce((acc, doc) => {
    if (!doc.parent_document_id) {
      // This is a root document, check if we have a newer version
      const newerVersions = categoryDocs.filter(
        (d) => d.parent_document_id === doc.id,
      );
      if (newerVersions.length > 0) {
        // Use the newest version
        const newest = newerVersions.sort((a, b) => b.version - a.version)[0];
        acc.push(newest);
      } else {
        acc.push(doc);
      }
    }
    return acc;
  }, [] as ProjectDocument[]);

  return latestDocs.length > 0
    ? latestDocs
    : categoryDocs.filter((d) => !d.parent_document_id);
}

// ============================================================================
// Comment Functions
// ============================================================================

/**
 * Get comments for a document version
 */
export async function getDocumentComments(
  documentId: string,
  version?: number,
): Promise<RepositoryListResult<DocumentCommentWithUser>> {
  return executeListQuery(async () => {
    let query = supabase
      .from("project_document_comments")
      .select(
        `
        *,
        users_profile:user_id (nome, email)
      `,
      )
      .eq("document_id", documentId)
      .order("created_at", { ascending: true });

    if (version !== undefined) {
      query = query.eq("version", version);
    }

    const { data, error } = await query;

    if (error) return { data: null, error };

    return {
      data: (data ?? []).map((c: any) => ({
        ...c,
        user_name: c.users_profile?.nome,
        user_email: c.users_profile?.email,
        users_profile: undefined,
      })),
      error: null,
    };
  });
}

/**
 * Add a comment to a document
 */
export async function addDocumentComment(
  input: CreateCommentInput,
  userId: string,
): Promise<RepositoryResult<DocumentComment>> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from("project_document_comments")
      .insert({
        project_id: input.project_id,
        document_id: input.document_id,
        version: input.version,
        user_id: userId,
        comment: input.comment,
        page_number: input.page_number ?? null,
      })
      .select()
      .single();

    return { data, error };
  });
}

/**
 * Delete a comment
 */
export async function deleteDocumentComment(
  commentId: string,
): Promise<RepositoryResult<null>> {
  return executeQuery(async () => {
    const { error } = await supabase
      .from("project_document_comments")
      .delete()
      .eq("id", commentId);

    return { data: null, error };
  });
}

/**
 * Get signed URL for a specific document version
 */
export async function getSignedUrlForDocument(
  doc: ProjectDocument,
): Promise<string | null> {
  const { data } = await supabase.storage
    .from(doc.storage_bucket)
    .createSignedUrl(doc.storage_path, SIGNED_URL_EXPIRY_SECONDS);

  return data?.signedUrl ?? null;
}

/**
 * Get approver information for a document
 */
export async function getApproverInfo(
  approvedBy: string | null,
): Promise<{ name: string; email: string } | null> {
  if (!approvedBy) return null;

  const { data } = await supabase
    .from("users_profile")
    .select("nome, email")
    .eq("id", approvedBy)
    .single();

  return data ? { name: data.nome, email: data.email } : null;
}
