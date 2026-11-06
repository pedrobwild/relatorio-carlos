/**
 * Gera o PDF do cronograma, guarda em `files` (bucket privado) e em
 * Documentos da obra, e devolve uma URL assinada de 7 dias.
 */
import { filesRepo, scheduleExportRepo } from "@/infra/repositories";
import type { ProjectActivity } from "@/hooks/useProjectActivities";
import {
  generateCronogramaPdf,
  type CronogramaPdfProject,
} from "@/lib/pdf/cronogramaPdf";

export const SCHEDULE_BUCKET = "project-documents";
export const SIGNED_URL_7_DAYS = 7 * 24 * 60 * 60;

export interface StoredSchedulePdf {
  file: File;
  fileName: string;
  url: string;
  start: string | null;
  end: string | null;
}

export async function generateAndStoreSchedulePdf(params: {
  project: CronogramaPdfProject & { id: string };
  activities: ProjectActivity[];
  userId: string;
  revision: number;
}): Promise<StoredSchedulePdf> {
  const { doc, fileName, start, end } = await generateCronogramaPdf(
    { ...params.project, schedule_revision: params.revision },
    params.activities,
  );
  const blob = doc.output("blob");
  const file = new File([blob], fileName, { type: "application/pdf" });

  const up = await filesRepo.uploadFile(file, {
    bucket: SCHEDULE_BUCKET,
    ownerId: params.userId,
    projectId: params.project.id,
    category: "cronograma",
    entityType: "project",
    entityId: params.project.id,
    description: `Cronograma R${params.revision}`,
  });
  if (up.error || !up.data) {
    throw new Error(up.error?.message ?? "Falha ao salvar o PDF");
  }
  const url = await filesRepo.getSignedUrl(
    up.data.bucket,
    up.data.storage_path,
    SIGNED_URL_7_DAYS,
  );
  if (!url) throw new Error("Não foi possível criar o link do PDF");

  await scheduleExportRepo.registerScheduleDocument({
    projectId: params.project.id,
    userId: params.userId,
    name: fileName,
    storagePath: up.data.storage_path,
    storageBucket: up.data.bucket,
    sizeBytes: file.size,
    description: `Cronograma enviado ao cliente (R${params.revision})`,
  });
  await scheduleExportRepo.saveScheduleExportState(params.project.id, {
    revision: params.revision,
    exportedEnd: end,
  });

  return { file, fileName, url, start, end };
}

/** Telefone para wa.me: só dígitos, com 55 quando vier sem DDI. */
export function normalizeWhatsAppPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] || "tudo bem";
}

/** Houve mudança de datas depois da última exportação? */
export function needsNewRevision(
  activities: Pick<ProjectActivity, "updated_at">[],
  exportedAt: string | null,
): boolean {
  if (!exportedAt) return false;
  return activities.some((a) => a.updated_at && a.updated_at > exportedAt);
}
