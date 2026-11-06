import { useEffect, useState } from "react";
import { Loader2, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CRONOGRAMA_PDF_COPY as COPY } from "@/content/cronogramaPdf";
import { normalizeWhatsAppPhone } from "@/lib/pdf/cronogramaExport";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultPhone: string | null;
  /** Gera e guarda o PDF; devolve o arquivo e a mensagem pronta. */
  onPrepare: () => Promise<{ file: File; url: string; message: string }>;
}

/** Diálogo de envio do cronograma por WhatsApp (pede telefone se faltar). */
export function SendScheduleWhatsAppDialog({
  open,
  onOpenChange,
  defaultPhone,
  onPrepare,
}: Props) {
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [prepared, setPrepared] = useState<{
    file: File;
    url: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setPhone(defaultPhone ?? "");
      setPrepared(null);
    }
  }, [open, defaultPhone]);

  const canShareFiles = (file: File) =>
    typeof navigator !== "undefined" &&
    "canShare" in navigator &&
    navigator.canShare?.({ files: [file] });

  const ensurePrepared = async () => {
    if (prepared) return prepared;
    const p = await onPrepare();
    setPrepared(p);
    return p;
  };

  const openWa = async () => {
    const digits = normalizeWhatsAppPhone(phone);
    if (!digits) {
      toast.error(COPY.errors.noPhone);
      return;
    }
    setBusy(true);
    try {
      const p = await ensurePrepared();
      window.open(
        `https://wa.me/${digits}?text=${encodeURIComponent(p.message)}`,
        "_blank",
        "noopener",
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : COPY.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  const shareNative = async () => {
    setBusy(true);
    try {
      const p = await ensurePrepared();
      await navigator.share({ files: [p.file], text: p.message });
      onOpenChange(false);
    } catch (err) {
      if ((err as DOMException)?.name !== "AbortError") {
        toast.error(err instanceof Error ? err.message : COPY.errors.generic);
      }
    } finally {
      setBusy(false);
    }
  };

  const supportsShare =
    typeof navigator !== "undefined" && "canShare" in navigator;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{COPY.ui.dialogTitle}</DialogTitle>
          <DialogDescription>
            O PDF fica salvo em Documentos da obra e o link vale por 7 dias.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="wa-phone">{COPY.ui.phoneLabel}</Label>
          <Input
            id="wa-phone"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
            className="min-h-[44px]"
          />
          {!normalizeWhatsAppPhone(phone) && (
            <p className="text-xs text-muted-foreground">{COPY.errors.noPhone}</p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {supportsShare && (
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={busy}
              onClick={async () => {
                const p = prepared ?? (await ensurePrepared().catch(() => null));
                if (p && canShareFiles(p.file)) await shareNative();
                else toast.error("Este aparelho não compartilha arquivos. Use o WhatsApp.");
              }}
            >
              <Share2 className="mr-2 h-4 w-4" /> {COPY.ui.shareNative}
            </Button>
          )}
          <Button
            type="button"
            className="min-h-[44px]"
            disabled={busy || !normalizeWhatsAppPhone(phone)}
            onClick={openWa}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="mr-2 h-4 w-4" />
            )}
            {busy ? COPY.ui.sending : COPY.ui.openWhatsApp}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
