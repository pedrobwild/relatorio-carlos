/**
 * Files Repository
 *
 * Centralized data access for the scalable file storage system.
 * Handles file metadata, signed URLs, lifecycle management, and deduplication.
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

export type FileStatus = "active" | "archived" | "deleted";
export type FileVisibility = "private" | "team" | "public";

export interface FileMetadata {
  id: string;
  bucket: string;
  storage_path: string;
  owner_id: string;
  org_id: string | null;
  project_id: string | null;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  checksum: string | null;
  category: string | null;
  tags: string[];
  description: string | null;
  status: FileStatus;
  visibility: FileVisibility;
  retention_days: number | null;
  expires_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileWithUrl extends FileMetadata {
  url: string | null;
}

export interface CreateFileInput {
  bucket: string;
  storage_path: string;
  owner_id: string;
  org_id?: string;
  project_id?: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  checksum?: string;
  category?: string;
  tags?: string[];
  description?: string;
  visibility?: FileVisibility;
  retention_days?: number;
  entity_type?: string;
  entity_id?: string;
}

export interface FileFilters {
  project_id?: string;
  org_id?: string;
  owner_id?: string;
  category?: string;
  status?: FileStatus;
  entity_type?: string;
  entity_id?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

// Allowed MIME types for upload validation
export const ALLOWED_MIME_TYPES = [
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Videos
  "video/mp4",
  "video/quicktime",
  "video/webm",
  // Archives
  "application/zip",
  "application/x-rar-compressed",
];

// Maximum file size: 500MB
export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;
const MIN_FILE_SIZE_BYTES = 1;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate file for upload
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size < MIN_FILE_SIZE_BYTES) {
    return { valid: false, error: "Arquivo vazio não é permitido" };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Arquivo muito grande. Máximo permitido: ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: "Tipo de arquivo não permitido" };
  }

  // Check for path traversal in filename
  if (
    file.name.includes("..") ||
    file.name.includes("/") ||
    file.name.includes("\\")
  ) {
    return { valid: false, error: "Nome de arquivo inválido" };
  }

  return { valid: true };
}

/**
 * Sanitize filename for storage
 */
export function sanitizeFilename(filename: string): string {
  // Remove path traversal and special characters
  const sanitized = filename
    .replace(/\.\./g, "")
    .replace(/[/\\]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);

  return sanitized || "unnamed_file";
}

// ============================================================================
// Media Helpers
// ============================================================================

const MEDIA_MIME_PREFIXES = ["image/", "video/", "audio/"];

function isMediaType(mimeType: string): boolean {
  return MEDIA_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

function getCacheControl(mimeType: string): string {
  if (isMediaType(mimeType)) {
    return "31536000";
  }

  return "3600";
}

async function computeChecksum(file: File): Promise<string | null> {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch (error) {
    console.warn("Could not compute file checksum", error);
    return null;
  }
}

async function findDuplicateFile(
  checksum: string,
  ownerId: string,
  projectId?: string,
): Promise<FileMetadata | null> {
  let query = supabase
    .from("files")
    .select("*")
    .eq("checksum", checksum)
    .eq("owner_id", ownerId)
    .eq("status", "active")
    .limit(1);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0] as FileMetadata;
}

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * Create file metadata record
 */
export async function createFileMetadata(
  input: CreateFileInput,
): Promise<RepositoryResult<FileMetadata>> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from("files")
      .insert({
        bucket: input.bucket,
        storage_path: input.storage_path,
        owner_id: input.owner_id,
        org_id: input.org_id ?? null,
        project_id: input.project_id ?? null,
        original_name: input.original_name,
        mime_type: input.mime_type,
        size_bytes: input.size_bytes,
        checksum: input.checksum ?? null,
        category: input.category ?? null,
        tags: input.tags ?? [],
        description: input.description ?? null,
        visibility: input.visibility ?? "private",
        retention_days: input.retention_days ?? null,
        entity_type: input.entity_type ?? null,
        entity_id: input.entity_id ?? null,
      })
      .select()
      .single();

    if (error) return { data: null, error };

    return {
      data: data as FileMetadata,
      error: null,
    };
  });
}

/**
 * Get file by ID
 */
export async function getFileById(
  fileId: string,
): Promise<RepositoryResult<FileMetadata>> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from("files")
      .select("*")
      .eq("id", fileId)
      .single();

    if (error) return { data: null, error };

    return {
      data: data as FileMetadata,
      error: null,
    };
  });
}

/**
 * Get files with filters and pagination
 */
export async function getFiles(
  filters: FileFilters,
  params: PaginationParams = {},
): Promise<PaginatedResult<FileMetadata>> {
  const { from, to } = getPaginationRange(params);

  let query = supabase
    .from("files")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  // Apply filters
  if (filters.project_id) {
    query = query.eq("project_id", filters.project_id);
  }
  if (filters.org_id) {
    query = query.eq("org_id", filters.org_id);
  }
  if (filters.owner_id) {
    query = query.eq("owner_id", filters.owner_id);
  }
  if (filters.category) {
    query = query.eq("category", filters.category);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  } else {
    // Default to active files only
    query = query.eq("status", "active");
  }
  if (filters.entity_type && filters.entity_id) {
    query = query
      .eq("entity_type", filters.entity_type)
      .eq("entity_id", filters.entity_id);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching files:", error);
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
    data: (data ?? []) as FileMetadata[],
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

/**
 * Generate signed URL for file download
 */
export async function getSignedUrl(
  bucket: string,
  storagePath: string,
  expiresIn: number = SIGNED_URL_EXPIRY_SECONDS,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    console.error("Error creating signed URL:", error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Get files with signed URLs
 */
export async function getFilesWithUrls(
  files: FileMetadata[],
): Promise<FileWithUrl[]> {
  const filesWithUrls = await Promise.all(
    files.map(async (file) => {
      const url = await getSignedUrl(file.bucket, file.storage_path);
      return { ...file, url };
    }),
  );

  return filesWithUrls;
}

/**
 * Soft delete a file (mark as deleted)
 */
export async function softDeleteFile(
  fileId: string,
): Promise<RepositoryResult<FileMetadata>> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from("files")
      .update({ status: "deleted", deleted_at: new Date().toISOString() })
      .eq("id", fileId)
      .select()
      .single();

    if (error) return { data: null, error };

    return {
      data: data as FileMetadata,
      error: null,
    };
  });
}

/**
 * Archive a file
 */
export async function archiveFile(
  fileId: string,
): Promise<RepositoryResult<FileMetadata>> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from("files")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("id", fileId)
      .select()
      .single();

    if (error) return { data: null, error };

    return {
      data: data as FileMetadata,
      error: null,
    };
  });
}

/**
 * Check for duplicate files by checksum
 */
export async function findDuplicateByChecksum(
  checksum: string,
  ownerId?: string,
  projectId?: string,
): Promise<FileMetadata | null> {
  const { data, error } = await supabase.rpc("find_duplicate_file", {
    p_checksum: checksum,
    p_owner_id: ownerId,
    p_project_id: projectId,
  });

  if (error || !data || data.length === 0) {
    return null;
  }

  // Fetch full file metadata
  const result = await getFileById(data[0].id);
  return result.data;
}

/**
 * Generate storage path using database function
 */
export async function generateStoragePath(
  orgId: string | null,
  projectId: string | null,
  filename: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("generate_file_storage_path", {
    p_org_id: orgId as string,
    p_project_id: projectId as string,
    p_filename: sanitizeFilename(filename),
  });

  if (error) {
    console.error("Error generating storage path:", error);
    // Fallback to client-side generation
    const uuid = crypto.randomUUID();
    const safeFilename = sanitizeFilename(filename);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${orgId ?? "shared"}/${projectId ?? "general"}/${year}/${month}/${uuid}_${safeFilename}`;
  }

  return data;
}

/**
 * Upload file to storage and create metadata
 */
export async function uploadFile(
  file: File,
  options: {
    bucket: string;
    ownerId: string;
    orgId?: string;
    projectId?: string;
    category?: string;
    entityType?: string;
    entityId?: string;
    description?: string;
  },
): Promise<RepositoryResult<FileWithUrl>> {
  // Validate file
  const validation = validateFile(file);
  if (!validation.valid) {
    return {
      data: null,
      error: {
        message: validation.error!,
        details: "",
        hint: "",
        code: "VALIDATION_ERROR",
      } as never,
    };
  }

  try {
    const checksum = await computeChecksum(file);

    if (checksum) {
      const duplicate = await findDuplicateFile(
        checksum,
        options.ownerId,
        options.projectId,
      );

      if (duplicate) {
        const url = await getSignedUrl(
          duplicate.bucket,
          duplicate.storage_path,
        );
        return {
          data: { ...duplicate, url },
          error: null,
        };
      }
    }

    // Generate storage path
    const storagePath = await generateStoragePath(
      options.orgId ?? null,
      options.projectId ?? null,
      file.name,
    );

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from(options.bucket)
      .upload(storagePath, file, {
        cacheControl: getCacheControl(file.type),
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return {
        data: null,
        error: {
          message: uploadError.message,
          details: "",
          hint: "",
          code: "STORAGE_ERROR",
        } as never,
      };
    }

    // Create metadata record
    const metadataResult = await createFileMetadata({
      bucket: options.bucket,
      storage_path: storagePath,
      owner_id: options.ownerId,
      org_id: options.orgId,
      project_id: options.projectId,
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      checksum: checksum ?? undefined,
      category: options.category,
      entity_type: options.entityType,
      entity_id: options.entityId,
      description: options.description,
    });

    if (metadataResult.error) {
      // Cleanup: delete uploaded file if metadata creation failed
      await supabase.storage.from(options.bucket).remove([storagePath]);
      return { data: null, error: metadataResult.error };
    }

    // Get signed URL
    const url = await getSignedUrl(options.bucket, storagePath);

    return {
      data: { ...metadataResult.data!, url },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : "Upload failed",
        details: "",
        hint: "",
        code: "UNKNOWN",
      } as never,
    };
  }
}
