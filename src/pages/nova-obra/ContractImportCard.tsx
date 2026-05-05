import { useState, useRef } from "react";
import {
  FileUp,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  FileText,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { FormData, ContractImportState, ContractParseResult } from "./types";

interface ContractImportCardProps {
  contractState: ContractImportState;
  onContractStateChange: (
    updater: (prev: ContractImportState) => ContractImportState,
  ) => void;
  formData: FormData;
  onApplyPrefill: (result: ContractParseResult, fileName: string) => void;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function ContractImportCard({
  contractState,
  onContractStateChange,
  formData: _formData,
  onApplyPrefill,
}: ContractImportCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.includes("pdf")) {
      onContractStateChange((prev) => ({
        ...prev,
        parseStatus: "error",
        errorMessage: "Apenas arquivos PDF são aceitos.",
      }));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      onContractStateChange((prev) => ({
        ...prev,
        parseStatus: "error",
        errorMessage: "Arquivo excede o limite de 20MB.",
      }));
      return;
    }

    onContractStateChange((prev) => ({
      ...prev,
      file,
      parseStatus: "uploading",
      errorMessage: "",
    }));

    try {
      // Convert to base64
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const fileBase64 = btoa(binary);

      onContractStateChange((prev) => ({
        ...prev,
        file,
        parseStatus: "parsing",
        errorMessage: "",
      }));

      // Call edge function
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-contract-prefill`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            file_base64: fileBase64,
            file_name: file.name,
          }),
        },
      );

      if (!response.ok) {
        const err = await response
          .json()
          .catch(() => ({ error: "Falha na análise" }));
        throw new Error(err.error || `Erro ${response.status}`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error("Resposta inválida do serviço");
      }

      const parseResult: ContractParseResult = result.data;

      onContractStateChange((prev) => ({
        ...prev,
        file,
        parseStatus: "success",
        parseResult,
        errorMessage: "",
        aiConflicts: parseResult.conflicts || [],
        aiMissingFields: parseResult.missing_fields || [],
        aiSourceDocumentName: file.name,
      }));

      // Apply prefill
      onApplyPrefill(parseResult, file.name);
    } catch (err) {
      console.error("Contract parse error:", err);
      onContractStateChange((prev) => ({
        ...prev,
        file,
        parseStatus: "error",
        errorMessage:
          err instanceof Error ? err.message : "Erro ao processar contrato",
      }));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleClear = () => {
    onContractStateChange(() => ({
      file: null,
      parseStatus: "idle",
      parseResult: null,
      errorMessage: "",
      aiPrefilledFields: new Set(),
      aiConflicts: [],
      aiMissingFields: [],
      aiSourceDocumentName: "",
      aiLastAppliedAt: null,
    }));
  };

  const isProcessing =
    contractState.parseStatus === "uploading" ||
    contractState.parseStatus === "parsing";
  const isSuccess = contractState.parseStatus === "success";
  const isError = contractState.parseStatus === "error";
  const hasConflicts = contractState.aiConflicts.length > 0;

  return (
    <Card
      className={cn(
        "transition-colors",
        isSuccess && "border-primary/30 bg-primary/5",
        isError && "border-destructive/30 bg-destructive/5",
        dragActive && "border-primary ring-2 ring-primary/20",
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-body">
          <Sparkles className="h-5 w-5 text-primary" />
          Importar Contrato do Cliente
        </CardTitle>
        <CardDescription>
          {isSuccess
            ? "Dados preenchidos automaticamente com base no contrato. Revise antes de salvar."
            : "Envie o contrato e vamos preencher os dados automaticamente com IA"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Upload zone */}
        {!isSuccess && !isProcessing && (
          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
              dragActive
                ? "border-primary bg-primary/10"
                : "border-muted-foreground/20 hover:border-primary/50",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
            <p className="text-sm font-medium">
              Arraste o PDF do contrato aqui
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ou clique para selecionar · PDF até 20MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        )}

        {/* Processing state */}
        {isProcessing && (
          <div
            className="flex items-center gap-3 py-4 justify-center"
            role="status"
            aria-live="polite"
          >
            <Loader2
              className="h-5 w-5 animate-spin text-primary"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium">
                {contractState.parseStatus === "uploading"
                  ? "Enviando contrato..."
                  : "Analisando contrato com IA..."}
              </p>
              <p className="text-xs text-muted-foreground">
                Isso pode levar alguns segundos
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="space-y-2" role="alert">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="text-sm font-medium">
                {contractState.errorMessage}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleClear}>
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Success */}
        {isSuccess && (
          <div className="space-y-3" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium truncate">
                  {contractState.aiSourceDocumentName}
                </span>
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Analisado
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleClear}
                title="Remover contrato"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Stats */}
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px]">
                {contractState.aiPrefilledFields.size} campos preenchidos
              </Badge>
              {hasConflicts && (
                <Badge variant="destructive" className="text-[10px]">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {contractState.aiConflicts.length} divergência(s)
                </Badge>
              )}
              {contractState.aiMissingFields.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {contractState.aiMissingFields.length} não encontrado(s)
                </Badge>
              )}
            </div>

            {/* Conflicts detail */}
            {hasConflicts && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 p-3 space-y-1.5">
                <p className="text-xs font-medium text-amber-700">
                  Encontramos possíveis divergências no contrato. Revise os
                  campos destacados.
                </p>
                {contractState.aiConflicts.map((c, i) => (
                  <p key={i} className="text-[11px] text-amber-600">
                    • <strong>{c.field}</strong>: {c.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Skip option */}
        {!isSuccess && !isProcessing && (
          <p className="text-[11px] text-muted-foreground text-center">
            Etapa opcional — você pode preencher todos os dados manualmente
          </p>
        )}
      </CardContent>
    </Card>
  );
}
