import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Copy,
  Loader2,
  Sparkles,
  Upload,
  Trash2,
  FileText,
  Download,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  useBoletoUpload,
  useBoletoDelete,
  downloadBoleto,
} from "@/hooks/useBoletoUpload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  validatePixKey,
  getPixTypeLabel,
  PIX_MAX_LENGTH,
} from "@/lib/pixValidation";
import { validateBoletoLine } from "@/lib/boletoValidation";

type PaymentMethod =
  | "pix"
  | "boleto"
  | "cartao"
  | "transferencia"
  | "cheque"
  | "";

interface PaymentMethodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string;
  projectId: string;
  installmentNumber: number;
  description: string;
  initialMethod: PaymentMethod;
  initialPixKey: string | null;
  initialBoletoCode: string | null;
  initialBoletoPath: string | null;
  onSaved?: () => void;
}

const METHOD_LABELS: Record<Exclude<PaymentMethod, "">, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cartao: "Cartão",
  transferencia: "Transferência",
  cheque: "Cheque",
};

function formatBoletoLine(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 48);
  if (d.length < 47) return d;
  // Padrão 5.5 5.6 5.6 1 14 → 47 dígitos
  // Ex: 00190.00009 03374.477008 06550.034184 4 89160000045678
  return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d.slice(32, 33)} ${d.slice(33, 47)}`;
}

export function PaymentMethodModal({
  open,
  onOpenChange,
  paymentId,
  projectId,
  installmentNumber,
  description,
  initialMethod,
  initialPixKey,
  initialBoletoCode,
  initialBoletoPath,
  onSaved,
}: PaymentMethodModalProps) {
  const [method, setMethod] = useState<PaymentMethod>(initialMethod || "");
  const [pixKey, setPixKey] = useState<string>(initialPixKey || "");
  const [boletoCode, setBoletoCode] = useState<string>(initialBoletoCode || "");
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [openSection, setOpenSection] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const boletoUpload = useBoletoUpload();
  const boletoDelete = useBoletoDelete();

  useEffect(() => {
    if (open) {
      setMethod(initialMethod || "");
      setPixKey(initialPixKey || "");
      setBoletoCode(initialBoletoCode || "");
      setOpenSection(initialMethod || "");
    }
  }, [open, initialMethod, initialPixKey, initialBoletoCode]);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleBoletoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    // Garante que a seção do Boleto esteja aberta para o feedback aparecer
    setMethod("boleto");
    setOpenSection("boleto");

    // 1) Upload para storage
    boletoUpload.mutate(
      { paymentId, projectId, file },
      {
        onSuccess: async () => {
          // 2) Extrair código via IA
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
            const extracted = (data?.code || "").toString().replace(/\D/g, "");

            if (extracted.length === 0) {
              toast.info(
                "Não foi possível extrair o código automaticamente. Preencha manualmente.",
              );
              return;
            }

            // Atualiza o estado — o useMemo de boletoValidation revalida na hora
            setBoletoCode(extracted);

            // Revalida síncronamente para decidir o feedback e a persistência
            const result = validateBoletoLine(extracted);

            if (result.valid && extracted.length >= 47) {
              // Persiste apenas se a linha digitável for válida
              await supabase
                .from("project_payments")
                .update({ boleto_code: extracted })
                .eq("id", paymentId);
              toast.success("Código extraído e validado pela IA ✓");
            } else if (extracted.length >= 47 && !result.valid) {
              toast.warning(
                `IA leu o código, mas a validação falhou: ${result.error}. Revise antes de salvar.`,
              );
            } else {
              toast.warning(
                `Código parcialmente reconhecido (${extracted.length}/47 dígitos). Complete manualmente.`,
              );
            }
          } catch (err) {
            console.error("Erro ao extrair código:", err);
            toast.error("Não foi possível extrair o código automaticamente.");
          } finally {
            setExtracting(false);
          }
        },
      },
    );
  };

  const pixValidation = useMemo(() => {
    if (!pixKey.trim()) return null;
    return validatePixKey(pixKey);
  }, [pixKey]);

  const boletoDigits = useMemo(
    () => boletoCode.replace(/\D/g, ""),
    [boletoCode],
  );
  const boletoValidation = useMemo(() => {
    if (boletoDigits.length === 0) return null;
    return validateBoletoLine(boletoDigits);
  }, [boletoDigits]);

  const handleSave = async () => {
    // Validação PIX antes de salvar
    if (method === "pix") {
      const result = validatePixKey(pixKey);
      if (!result.valid) {
        toast.error(result.error || "Chave PIX inválida");
        setOpenSection("pix");
        return;
      }
    }

    // Validação da linha digitável do boleto antes de salvar
    if (method === "boleto" && boletoDigits.length > 0) {
      const result = validateBoletoLine(boletoDigits);
      if (!result.valid) {
        toast.error(result.error || "Linha digitável inválida");
        setOpenSection("boleto");
        return;
      }
    }

    setSaving(true);
    try {
      const normalizedPix =
        method === "pix" && pixKey.trim()
          ? validatePixKey(pixKey).normalized
          : null;
      const updates: {
        payment_method: string | null;
        pix_key: string | null;
        boleto_code: string | null;
      } = {
        payment_method: method || null,
        pix_key: method === "pix" ? normalizedPix : null,
        boleto_code: method === "boleto" ? boletoDigits || null : null,
      };
      const { error } = await supabase
        .from("project_payments")
        .update(updates)
        .eq("id", paymentId);
      if (error) throw error;
      toast.success("Forma de pagamento salva");
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar forma de pagamento");
    } finally {
      setSaving(false);
    }
  };

  const sections: { value: PaymentMethod; label: string }[] = [
    { value: "pix", label: "PIX" },
    { value: "boleto", label: "Boleto" },
    { value: "cartao", label: "Cartão" },
    { value: "transferencia", label: "Transferência" },
    { value: "cheque", label: "Cheque" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Forma de Pagamento</DialogTitle>
          <DialogDescription>
            Parcela #{installmentNumber} — {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Selecione a forma de pagamento
          </Label>
          <Tabs
            value={method}
            onValueChange={(v) => {
              setMethod(v as PaymentMethod);
              setOpenSection(v);
            }}
          >
            <TabsList className="grid grid-cols-5 w-full h-auto">
              {sections.map((s) => (
                <TabsTrigger
                  key={s.value}
                  value={s.value as string}
                  className="text-xs py-2"
                >
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-3">
          {/* PIX */}
          <Collapsible
            open={openSection === "pix"}
            onOpenChange={(o) => setOpenSection(o ? "pix" : "")}
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className={cn(
                  "w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                  method === "pix"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <span className="text-sm font-medium">PIX</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    openSection === "pix" && "rotate-180",
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 py-3 space-y-3 border border-t-0 rounded-b-lg">
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Tipos aceitos:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>CPF (11 dígitos) ou CNPJ (14 dígitos)</li>
                  <li>E-mail (até 77 caracteres)</li>
                  <li>
                    Telefone no formato{" "}
                    <code className="font-mono">+55DDDNNNNNNNNN</code>
                  </li>
                  <li>Chave aleatória (UUID)</li>
                  <li>Copia e Cola (BR Code/EMV completo)</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pix-key" className="text-xs">
                  Chave PIX ou Copia e Cola
                </Label>
                {pixKey.length > 80 ? (
                  <Textarea
                    id="pix-key"
                    placeholder="Cole aqui a chave ou o código Copia e Cola"
                    value={pixKey}
                    onChange={(e) =>
                      setPixKey(e.target.value.slice(0, PIX_MAX_LENGTH))
                    }
                    rows={4}
                    className="font-mono text-xs"
                    maxLength={PIX_MAX_LENGTH}
                  />
                ) : (
                  <Input
                    id="pix-key"
                    placeholder="CPF, CNPJ, e-mail, +55…, UUID ou Copia e Cola"
                    value={pixKey}
                    onChange={(e) =>
                      setPixKey(e.target.value.slice(0, PIX_MAX_LENGTH))
                    }
                    maxLength={PIX_MAX_LENGTH}
                  />
                )}
                <div className="flex items-center justify-between text-xs">
                  {pixValidation ? (
                    pixValidation.valid ? (
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {getPixTypeLabel(pixValidation.type)} válido
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {pixValidation.error}
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground">
                      A chave será exibida ao cliente no pagamento.
                    </span>
                  )}
                  <span className="text-muted-foreground tabular-nums">
                    {pixKey.length}/{PIX_MAX_LENGTH}
                  </span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Boleto */}
          <Collapsible
            open={openSection === "boleto"}
            onOpenChange={(o) => setOpenSection(o ? "boleto" : "")}
          >
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className={cn(
                  "w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                  method === "boleto"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <span className="text-sm font-medium">Boleto</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    openSection === "boleto" && "rotate-180",
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 py-3 space-y-3 border border-t-0 rounded-b-lg">
              <div className="space-y-2">
                <Label className="text-xs">Arquivo do boleto</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleBoletoFileChange}
                />
                {initialBoletoPath ? (
                  <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs flex-1 truncate">
                      Boleto anexado
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => downloadBoleto(initialBoletoPath)}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Baixar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() =>
                        boletoDelete.mutate({
                          paymentId,
                          boletoPath: initialBoletoPath,
                        })
                      }
                      disabled={boletoDelete.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={boletoUpload.isPending || extracting}
                  >
                    {boletoUpload.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />{" "}
                        Enviando...
                      </>
                    ) : extracting ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2 animate-pulse" /> IA
                        lendo o boleto...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" /> Anexar boleto (PDF
                        ou imagem)
                      </>
                    )}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Ao anexar, a IA extrai automaticamente o código do boleto.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="boleto-code" className="text-xs">
                    Código do boleto (linha digitável)
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    Editável — recalculado ao salvar
                  </span>
                </div>
                <Input
                  id="boleto-code"
                  placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
                  value={formatBoletoLine(boletoCode)}
                  onChange={(e) =>
                    setBoletoCode(
                      e.target.value.replace(/\D/g, "").slice(0, 48),
                    )
                  }
                  className={cn(
                    "font-mono text-xs",
                    boletoValidation &&
                      !boletoValidation.valid &&
                      "border-destructive focus-visible:ring-destructive",
                    boletoValidation?.valid && "border-success/60",
                  )}
                  aria-invalid={
                    boletoValidation ? !boletoValidation.valid : undefined
                  }
                />
                <div className="flex items-center justify-between text-xs">
                  {boletoValidation ? (
                    boletoValidation.valid ? (
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Linha digitável válida
                        {boletoValidation.type === "arrecadacao" &&
                          " (arrecadação)"}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {boletoValidation.error}
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground">
                      Cole, digite ou anexe um arquivo para extração via IA.
                    </span>
                  )}
                  <span className="text-muted-foreground tabular-nums">
                    {boletoDigits.length}/47
                  </span>
                </div>

                {boletoValidation?.valid && (
                  <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Linha digitável reconhecida
                    </div>
                    <p
                      className="font-mono text-xs leading-relaxed break-all select-all bg-background rounded px-2 py-1.5 border"
                      aria-label="Linha digitável formatada"
                    >
                      {formatBoletoLine(boletoCode)}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs flex-1"
                        onClick={async () => {
                          const formatted = formatBoletoLine(boletoCode);
                          try {
                            await navigator.clipboard.writeText(formatted);
                            toast.success("Linha digitável copiada");
                          } catch {
                            toast.error("Não foi possível copiar");
                          }
                        }}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Copiar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs flex-1"
                        title="Copia apenas os 47 dígitos, sem pontos nem espaços. Útil para colar em internet banking e ERPs."
                        onClick={async () => {
                          const digits = boletoCode.replace(/\D/g, "");
                          try {
                            await navigator.clipboard.writeText(digits);
                            toast.success(
                              "Linha digitável copiada (texto puro, sem máscara)",
                            );
                          } catch {
                            toast.error("Não foi possível copiar");
                          }
                        }}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Texto puro
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs flex-1"
                        onClick={() => {
                          const formatted = formatBoletoLine(boletoCode);
                          const digits = boletoCode.replace(/\D/g, "");
                          const content = `Boleto - Parcela #${installmentNumber}\n${description}\n\nLinha digitável:\n${formatted}\n\nApenas dígitos:\n${digits}\n`;
                          const blob = new Blob([content], {
                            type: "text/plain;charset=utf-8",
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `boleto-parcela-${installmentNumber}.txt`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                          toast.success("Arquivo .txt baixado");
                        }}
                      >
                        <FileDown className="h-3.5 w-3.5 mr-1" />
                        .txt
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Demais métodos */}
          {(["cartao", "transferencia", "cheque"] as const).map((m) => (
            <Collapsible
              key={m}
              open={openSection === m}
              onOpenChange={(o) => setOpenSection(o ? m : "")}
            >
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                    method === m
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <span className="text-sm font-medium">
                    {METHOD_LABELS[m]}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      openSection === m && "rotate-180",
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 py-3 border border-t-0 rounded-b-lg">
                <p className="text-xs text-muted-foreground">
                  Selecione esta opção para registrar o pagamento via{" "}
                  {METHOD_LABELS[m].toLowerCase()}. Sem campos adicionais.
                </p>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              !method ||
              (method === "boleto" &&
                boletoDigits.length > 0 &&
                boletoValidation?.valid === false) ||
              (method === "pix" &&
                pixKey.trim().length > 0 &&
                pixValidation?.valid === false)
            }
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
