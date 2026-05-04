import { useRef, useState } from "react";
import {
  Upload,
  FileText,
  Sparkles,
  Trash2,
  Copy,
  Check,
  CalendarDays,
  CreditCard,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ProjectPurchase } from "@/hooks/useProjectPurchases";
import {
  InlineField,
  InlineSelect,
  useFieldAutosave,
  AutosaveStatusIcon,
} from "./InlineAutosave";
import { MaskedDateField } from "./MaskedDateField";

interface PaymentSectionProps {
  purchase: ProjectPurchase;
  onUpdateField: (id: string, field: string, value: string | null) => void;
}

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
  { value: "cartao", label: "Cartão" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "outro", label: "Outro" },
];

/* ─── Boleto upload + AI code extraction ─── */
function BoletoUploadAndExtract({
  purchase,
  onUpdateField,
}: PaymentSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [copied, setCopied] = useState(false);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const extractCode = async (file: File) => {
    setExtracting(true);
    try {
      const dataUrl = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke(
        "extract-boleto-code",
        {
          body: { fileBase64: dataUrl, mimeType: file.type },
        },
      );
      if (error) throw error;
      const code = (data?.code || "").toString();
      if (code) {
        onUpdateField(purchase.id, "boleto_code", code);
        toast.success("Código do boleto extraído por IA");
      } else {
        toast.warning(
          "Não foi possível identificar a linha digitável. Preencha manualmente.",
        );
      }
    } catch (err: unknown) {
      console.error("extract-boleto-code error:", err);
      const msg = err instanceof Error ? err.message : "Erro ao extrair código";
      toast.error(msg);
    } finally {
      setExtracting(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowed.includes(file.type)) {
      toast.error("Apenas PDF, PNG ou JPG são permitidos");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo deve ter até 10 MB");
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `purchases/${purchase.project_id}/${purchase.id}/boleto_${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("project-documents")
        .upload(path, file);
      if (uploadError) throw uploadError;

      onUpdateField(purchase.id, "boleto_file_path", path);
      toast.success("Boleto anexado");

      // Disparar extração via IA em seguida (sem bloquear UI)
      extractCode(file);
    } catch (err: unknown) {
      console.error("boleto upload error:", err);
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Erro ao enviar boleto: ${msg}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleView = async () => {
    if (!purchase.boleto_file_path) return;
    const { data } = await supabase.storage
      .from("project-documents")
      .createSignedUrl(purchase.boleto_file_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleRemove = async () => {
    if (!purchase.boleto_file_path) return;
    try {
      await supabase.storage
        .from("project-documents")
        .remove([purchase.boleto_file_path]);
    } catch (err) {
      // continue mesmo se a remoção do storage falhar
      console.warn("Falha ao remover arquivo do storage:", err);
    }
    onUpdateField(purchase.id, "boleto_file_path", null);
    onUpdateField(purchase.id, "boleto_code", null);
    toast.success("Boleto removido");
  };

  const handleReExtract = async () => {
    if (!purchase.boleto_file_path) return;
    setExtracting(true);
    try {
      const { data: blob, error } = await supabase.storage
        .from("project-documents")
        .download(purchase.boleto_file_path);
      if (error || !blob) throw error || new Error("Falha ao baixar boleto");
      const file = new File([blob], "boleto", {
        type: blob.type || "application/pdf",
      });
      await extractCode(file);
    } catch (err: unknown) {
      console.error("re-extract error:", err);
      const msg = err instanceof Error ? err.message : "Erro ao re-extrair";
      toast.error(msg);
      setExtracting(false);
    }
  };

  const handleCopy = async () => {
    if (!purchase.boleto_code) return;
    try {
      await navigator.clipboard.writeText(purchase.boleto_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        className="hidden"
        onChange={handleUpload}
      />

      <div className="flex flex-wrap items-center gap-2">
        {purchase.boleto_file_path ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 border-primary/30 text-primary"
              onClick={handleView}
            >
              <FileText className="h-3 w-3" /> Ver boleto
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleReExtract}
              disabled={extracting}
              title="Re-extrair código com IA"
            >
              {extracting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {extracting ? "Lendo…" : "Re-extrair"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
              onClick={handleRemove}
            >
              <Trash2 className="h-3 w-3" /> Remover
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            {uploading ? "Enviando…" : "Anexar boleto (PDF / PNG)"}
          </Button>
        )}
      </div>

      {/* Linha digitável (preenchida por IA, editável) */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-primary/70" />
          Linha digitável
          {extracting && (
            <span className="text-[10px] text-muted-foreground ml-1">
              extraindo…
            </span>
          )}
        </label>
        <BoletoCodeInput
          purchase={purchase}
          onUpdateField={onUpdateField}
          onCopy={handleCopy}
          copied={copied}
        />
      </div>
    </div>
  );
}

/* ─── Linha digitável do boleto, com autosave padronizado ─── */
function BoletoCodeInput({
  purchase,
  onUpdateField,
  onCopy,
  copied,
}: PaymentSectionProps & { onCopy: () => void; copied: boolean }) {
  const { saveState, runSave } = useFieldAutosave(purchase.boleto_code);

  return (
    <div className="flex items-center gap-1">
      <div className="relative flex-1">
        <Input
          key={purchase.boleto_code ?? ""}
          type="text"
          inputMode="numeric"
          placeholder={
            purchase.boleto_file_path
              ? "Será preenchida automaticamente após anexar"
              : "Anexe um boleto para extrair automaticamente"
          }
          defaultValue={purchase.boleto_code ?? ""}
          onBlur={(e) =>
            runSave(e.target.value.trim(), (v) =>
              onUpdateField(purchase.id, "boleto_code", v || null),
            )
          }
          className={cn(
            "h-8 text-sm font-mono",
            saveState !== "idle" && "pr-7",
          )}
        />
        <AutosaveStatusIcon
          state={saveState}
          className="absolute right-2 top-1/2 -translate-y-1/2"
        />
      </div>
      {purchase.boleto_code && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onCopy}
          title="Copiar"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}

/* ─── Main payment section ─── */
export function PaymentSection({
  purchase,
  onUpdateField,
}: PaymentSectionProps) {
  const method = purchase.payment_method || "";

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-2">
        <CreditCard className="h-3 w-3" /> Pagamento
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Vencimento */}
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <CalendarDays className="h-3 w-3" /> Data de vencimento
          </label>
          <MaskedDateField
            value={purchase.payment_due_date}
            onSave={(v) => onUpdateField(purchase.id, "payment_due_date", v)}
            ariaLabel="Data de vencimento"
            className="w-full"
          />
        </div>

        {/* Forma de pagamento */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Forma de pagamento
          </label>
          <InlineSelect
            value={purchase.payment_method}
            placeholder="Selecione…"
            onSave={(v) => onUpdateField(purchase.id, "payment_method", v)}
          >
            <SelectItem value="none">—</SelectItem>
            {PAYMENT_METHODS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </InlineSelect>
        </div>
      </div>

      {/* Campos condicionais por método */}
      {method === "pix" && (
        <div className="mt-3">
          <label className="text-xs text-muted-foreground block mb-1">
            Chave PIX
          </label>
          <InlineField
            value={purchase.pix_key}
            placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
            onSave={(v) =>
              onUpdateField(purchase.id, "pix_key", v.trim() || null)
            }
            className="w-full font-mono"
          />
        </div>
      )}

      {method === "boleto" && (
        <div className="mt-3">
          <BoletoUploadAndExtract
            purchase={purchase}
            onUpdateField={onUpdateField}
          />
        </div>
      )}
    </div>
  );
}
