import { useMemo } from "react";
import { ArrowRight, ImageOff, Plus, Minus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  diffReportVersions,
  type PhotoChange,
} from "./editor/versionDiff";
import type { WeeklyReportVersion } from "@/infra/repositories/weeklyReports.repository";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Versão mais antiga (base). */
  before: WeeklyReportVersion | null;
  /** Versão mais recente. */
  after: WeeklyReportVersion | null;
}

function PhotoCard({
  photo,
  tone,
}: {
  photo: PhotoChange;
  tone: "added" | "removed" | "changed";
}) {
  const ring =
    tone === "added"
      ? "ring-success/60"
      : tone === "removed"
        ? "ring-destructive/60"
        : "ring-warning/60";
  return (
    <li className={`rounded-lg border border-border p-2 ring-1 ${ring}`}>
      <div className="aspect-video rounded-md overflow-hidden bg-muted flex items-center justify-center">
        {photo.url ? (
          <img
            src={photo.url}
            alt={photo.caption || "Foto do relatório"}
            loading="lazy"
            className={`w-full h-full object-cover ${tone === "removed" ? "opacity-60 grayscale" : ""}`}
          />
        ) : (
          <ImageOff
            className="w-6 h-6 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>
      <p className="text-xs font-medium mt-2 line-clamp-2">
        {photo.caption || "Sem legenda"}
      </p>
      {photo.area && (
        <p className="text-xs text-muted-foreground">{photo.area}</p>
      )}
      {photo.fields?.map((field) => (
        <p
          key={field.label}
          className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-1"
        >
          <span className="font-medium text-foreground">{field.label}:</span>
          <span className="line-through">{field.before}</span>
          <ArrowRight className="w-3 h-3" aria-hidden="true" />
          <span>{field.after}</span>
        </p>
      ))}
    </li>
  );
}

/**
 * Comparação lado a lado entre duas versões salvas: o texto aparece com as
 * palavras removidas riscadas e as adicionadas destacadas; as fotos aparecem
 * separadas em adicionadas, removidas e editadas.
 */
export function VersionDiffDialog({
  open,
  onOpenChange,
  before,
  after,
}: Props) {
  const diff = useMemo(
    () => diffReportVersions(before?.data, after?.data),
    [before, after],
  );

  const photoGroups = [
    { key: "added" as const, label: "Fotos adicionadas", icon: Plus, items: diff.photos.added },
    { key: "removed" as const, label: "Fotos removidas", icon: Minus, items: diff.photos.removed },
    { key: "changed" as const, label: "Fotos editadas", icon: Pencil, items: diff.photos.changed },
  ].filter((g) => g.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Diferenças entre a versão {before?.version} e a versão{" "}
            {after?.version}
          </DialogTitle>
          <DialogDescription>
            Em verde o que foi adicionado na versão {after?.version}; riscado em
            vermelho o que saiu da versão {before?.version}.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {!diff.hasChanges && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhuma diferença de conteúdo entre estas duas versões.
              </p>
            )}

            {diff.textSections
              .filter((section) => section.changed)
              .map((section) => (
                <section key={section.label}>
                  <h3 className="text-sm font-semibold mb-2">
                    {section.label}
                  </h3>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap rounded-lg border border-border p-3">
                    {section.tokens.map((token, index) => {
                      if (token.type === "equal")
                        return <span key={index}>{token.value}</span>;
                      const cls =
                        token.type === "added"
                          ? "bg-success/15 text-success rounded px-0.5"
                          : "bg-destructive/15 text-destructive line-through rounded px-0.5";
                      return (
                        <span key={index} className={cls}>
                          {token.value}
                        </span>
                      );
                    })}
                  </p>
                </section>
              ))}

            {diff.listSections.map((section) => (
              <section key={section.label}>
                <h3 className="text-sm font-semibold mb-2">{section.label}</h3>
                <ul className="space-y-1.5">
                  {section.added.map((item, i) => (
                    <li
                      key={`a-${i}`}
                      className="text-sm flex gap-2 items-start text-success"
                    >
                      <Plus className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                  {section.removed.map((item, i) => (
                    <li
                      key={`r-${i}`}
                      className="text-sm flex gap-2 items-start text-destructive"
                    >
                      <Minus className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                      <span className="line-through">{item}</span>
                    </li>
                  ))}
                  {section.changed.map((item, i) => (
                    <li
                      key={`c-${i}`}
                      className="text-sm flex gap-2 items-start text-muted-foreground"
                    >
                      <Pencil className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                      <span className="flex flex-wrap items-center gap-1">
                        <span className="line-through">{item.before}</span>
                        <ArrowRight className="w-3 h-3" aria-hidden="true" />
                        <span className="text-foreground">{item.after}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {photoGroups.map((group) => (
              <section key={group.key}>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <group.icon className="w-4 h-4" aria-hidden="true" />
                  {group.label}
                  <Badge variant="secondary">{group.items.length}</Badge>
                </h3>
                <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {group.items.map((photo) => (
                    <PhotoCard key={photo.id} photo={photo} tone={group.key} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default VersionDiffDialog;
