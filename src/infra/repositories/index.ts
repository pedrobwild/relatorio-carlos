/**
 * Repositories Index
 *
 * Central export point for all data repositories.
 * Import from here to ensure consistent data access patterns.
 */

// Base utilities
export * from "./base.repository";

// Feature repositories
export * as documentsRepo from "./documents.repository";
export * as projectsRepo from "./projects.repository";
export * as filesRepo from "./files.repository";
export * as auditoriaRepo from "./auditoria.repository";
export * as journeyRepo from "./journey.repository";
export * as formalizationsRepo from "./formalizations.repository";
export * as agentMemoryRepo from "./agentMemory.repository";

// Re-export types for convenience
export type {
  ProjectDocument,
  DocumentWithUrl,
  DocumentCategory,
  DocumentStatus,
  CreateDocumentInput,
  ApproveDocumentInput,
} from "./documents.repository";

export type {
  Project,
  ProjectWithCustomer,
  ProjectStatus,
  ProjectSummary,
} from "./projects.repository";

export type {
  FileMetadata,
  FileWithUrl,
  FileStatus,
  FileVisibility,
  CreateFileInput,
  FileFilters,
} from "./files.repository";

export type {
  AgentEventType,
  AgentEventSource,
  AgentEventStatus,
  RoutedAgent,
  ProjectStateMemory,
  ProjectState,
  BwildAgentEvent,
  CreateAgentEventInput,
} from "./agentMemory.repository";
