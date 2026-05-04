import type {
  DiagnosticResult,
  AuthCheckResult,
  DbCheckResult,
  StorageCheckResult,
  RlsCheckResult,
} from "@/infra/repositories/diagnostics.repository";

export interface DiagnosticsState {
  loading: boolean;
  auth: AuthCheckResult | null;
  db: DbCheckResult | null;
  storage: StorageCheckResult | null;
  rls: RlsCheckResult | null;
  signedUrl: DiagnosticResult | null;
  totalLatencyMs: number;
  latencyHistory: number[];
  lastRun: Date | null;
}
