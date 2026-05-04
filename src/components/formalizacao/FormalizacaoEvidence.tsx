import { AttachmentsCard } from "./AttachmentsCard";
import { EvidenceLinksCard } from "./EvidenceLinksCard";

interface FormalizacaoEvidenceProps {
  formalizationId: string;
  attachments: Array<{
    id: string;
    original_filename: string;
    storage_path: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
  }>;
  evidenceLinks: Array<{
    id: string;
    kind: string;
    url: string;
    description: string | null;
    created_at: string;
  }>;
  isLocked: boolean;
}

export function FormalizacaoEvidence({
  formalizationId,
  attachments,
  evidenceLinks,
}: FormalizacaoEvidenceProps) {
  return (
    <div className="space-y-6">
      <AttachmentsCard
        formalizationId={formalizationId}
        attachments={attachments}
      />
      <EvidenceLinksCard
        formalizationId={formalizationId}
        evidenceLinks={evidenceLinks}
      />
    </div>
  );
}
