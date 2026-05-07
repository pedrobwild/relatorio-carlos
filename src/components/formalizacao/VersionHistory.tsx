import { useState } from "react";
import { History, ChevronDown, ChevronRight, Eye, GitCompare, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useFormalizationVersions,
  type FormalizationVersion,
} from "@/hooks/useFormalizationVersions";
import ReactMarkdown from "react-markdown";

interface VersionHistoryProps {
  formalizationId: string;
  currentTitle: string;
  currentSummary: string;
  currentBodyMd: string;
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Simple word-level diff for highlighting changes
function computeDiff(
  oldText: string,
  newText: string,
): { type: "same" | "added" | "removed"; text: string }[] {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);
  const result: { type: "same" | "added" | "removed"; text: string }[] = [];

  let i = 0,
    j = 0;

  while (i < oldWords.length || j < newWords.length) {
    if (i >= oldWords.length) {
      result.push({ type: "added", text: newWords[j] });
      j++;
    } else if (j >= newWords.length) {
      result.push({ type: "removed", text: oldWords[i] });
      i++;
    } else if (oldWords[i] === newWords[j]) {
      result.push({ type: "same", text: oldWords[i] });
      i++;
      j++;
    } else {
      // Look ahead to find matches
      const foundInNew = newWords.indexOf(oldWords[i], j);
      const foundInOld = oldWords.indexOf(newWords[j], i);

      if (
        foundInNew !== -1 &&
        (foundInOld === -1 || foundInNew - j <= foundInOld - i)
      ) {
        // Words were added
        while (j < foundInNew) {
          result.push({ type: "added", text: newWords[j] });
          j++;
        }
      } else if (foundInOld !== -1) {
        // Words were removed
        while (i < foundInOld) {
          result.push({ type: "removed", text: oldWords[i] });
          i++;
        }
      } else {
        result.push({ type: "removed", text: oldWords[i] });
        result.push({ type: "added", text: newWords[j] });
        i++;
        j++;
      }
    }
  }

  return result;
}

function DiffDisplay({
  oldText,
  newText,
  label,
}: {
  oldText: string;
  newText: string;
  label: string;
}) {
  const diff = computeDiff(oldText, newText);
  const hasChanges = diff.some((d) => d.type !== "same");

  if (!hasChanges) {
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm text-muted-foreground/70 italic">
          Sem alterações
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm leading-relaxed">
        {diff.map((part, idx) => (
          <span
            key={idx}
            className={
              part.type === "added"
                ? "bg-green-100 text-green-700"
                : part.type === "removed"
                  ? "bg-red-100 text-red-700 line-through"
                  : ""
            }
          >
            {part.text}
          </span>
        ))}
      </div>
    </div>
  );
}

function VersionCard({
  version,
  previousVersion,
  currentTitle,
  currentSummary,
  currentBodyMd,
  isLatest,
}: {
  version: FormalizationVersion;
  previousVersion?: FormalizationVersion;
  currentTitle: string;
  currentSummary: string;
  currentBodyMd: string;
  isLatest: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  // For diff comparison: compare this version to the next version (or current if latest)
  const compareToTitle = isLatest
    ? currentTitle
    : previousVersion?.title || version.title;
  const compareToSummary = isLatest
    ? currentSummary
    : previousVersion?.summary || version.summary;
  const compareToBody = isLatest
    ? currentBodyMd
    : previousVersion?.body_md || version.body_md;

  return (
    <div className="relative pl-6 pb-6 last:pb-0">
      {/* Timeline line */}
      <div className="absolute left-[7px] top-3 bottom-0 w-px bg-border last:hidden" />

      {/* Timeline dot */}
      <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-left hover:text-primary transition-colors"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="font-medium text-sm">
              Versão {version.version_number}
            </span>
          </button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(version.created_at)}</span>
          </div>
        </div>

        {expanded && (
          <div className="space-y-3 pt-2 animate-in slide-in-from-top-2 duration-200">
            <div className="flex gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <Eye className="h-3 w-3 mr-1" />
                    Ver conteúdo
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>
                      Versão {version.version_number} - {version.title}
                    </DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="max-h-[60vh]">
                    <div className="space-y-4 pr-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Resumo
                        </p>
                        <p className="text-sm">{version.summary}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Conteúdo
                        </p>
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown>{version.body_md}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>

              <Button
                variant={showDiff ? "secondary" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowDiff(!showDiff)}
              >
                <GitCompare className="h-3 w-3 mr-1" />
                {showDiff ? "Ocultar diff" : "Comparar"}
              </Button>
            </div>

            {showDiff && (
              <Card className="bg-muted/30">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Badge variant="outline" className="text-xs">
                      v{version.version_number} →{" "}
                      {isLatest ? "Atual" : `v${version.version_number + 1}`}
                    </Badge>
                  </div>

                  <DiffDisplay
                    oldText={version.title}
                    newText={compareToTitle}
                    label="Título"
                  />

                  <DiffDisplay
                    oldText={version.summary}
                    newText={compareToSummary}
                    label="Resumo"
                  />

                  <DiffDisplay
                    oldText={version.body_md}
                    newText={compareToBody}
                    label="Conteúdo"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function VersionHistory({
  formalizationId,
  currentTitle,
  currentSummary,
  currentBodyMd,
}: VersionHistoryProps) {
  const {
    data: versions,
    isLoading,
    error,
  } = useFormalizationVersions(formalizationId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico de Versões
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico de Versões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Erro ao carregar histórico de versões.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sortedVersions = [...(versions || [])].sort(
    (a, b) => b.version_number - a.version_number,
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Histórico de Versões
          {sortedVersions.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {sortedVersions.length}{" "}
              {sortedVersions.length === 1 ? "versão" : "versões"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedVersions.length === 0 ? (
          <div className="text-center py-6">
            <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <History className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">
              Nenhuma versão anterior registrada.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Versões são salvas automaticamente ao editar o documento.
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Current version indicator */}
            <div className="relative pl-6 pb-4">
              <div className="absolute left-[7px] top-3 bottom-0 w-px bg-border" />
              <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Versão Atual</span>
                <Badge variant="default" className="text-xs bg-green-600">
                  Ativa
                </Badge>
              </div>
            </div>

            {sortedVersions.map((version, index) => {
              const previousVersion = sortedVersions[index - 1];
              return (
                <VersionCard
                  key={version.id}
                  version={version}
                  previousVersion={previousVersion}
                  currentTitle={currentTitle}
                  currentSummary={currentSummary}
                  currentBodyMd={currentBodyMd}
                  isLatest={index === 0}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
