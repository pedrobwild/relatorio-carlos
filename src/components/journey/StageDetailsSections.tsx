import {
  AlertTriangle,
  Info,
  Target,
  ClipboardCheck,
  Wrench,
  ArrowRight,
  Package,
  HelpCircle,
  Lock,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { JourneyStage } from "@/hooks/useProjectJourney";

/* ─── helpers ─── */

/** Split a text block into bullet lines (by newline, "- ", "• ", or numbered "1. ") */
function toBullets(text: string): string[] {
  return text
    .split(/\n/)
    .map((l) => l.replace(/^[\s•\-\d.]+/, "").trim())
    .filter(Boolean);
}

/** Extract structured sections from a stage's description.
 *  Supports markdown-ish headers like "## Objetivo" or "**Objetivo:**"
 *  Falls back to showing the full description as "Objetivo". */
interface ParsedSections {
  objective: string | null;
  clientActions: string[];
  bwildActions: string[];
  nextStep: string | null;
  materials: string[];
  faq: string[];
  remaining: string | null;
}

const sectionPatterns: { key: keyof ParsedSections; regex: RegExp }[] = [
  { key: "objective", regex: /(?:^|\n)#+\s*(?:objetivo|sobre)[^\n]*/i },
  {
    key: "clientActions",
    regex:
      /(?:^|\n)#+\s*(?:o que voc[êe]|sua[s]? a[çc][ãa]o|checklist|to.?do)[^\n]*/i,
  },
  {
    key: "bwildActions",
    regex: /(?:^|\n)#+\s*(?:o que a bwild|bwild est[áa]|nosso trabalho)[^\n]*/i,
  },
  {
    key: "nextStep",
    regex: /(?:^|\n)#+\s*(?:o que vem|pr[óo]xim[oa]|depois)[^\n]*/i,
  },
  {
    key: "materials",
    regex: /(?:^|\n)#+\s*(?:materiais|documentos necess[áa]rios)[^\n]*/i,
  },
  { key: "faq", regex: /(?:^|\n)#+\s*(?:d[úu]vidas|perguntas|faq)[^\n]*/i },
];

function parseSections(description: string | null): ParsedSections {
  const result: ParsedSections = {
    objective: null,
    clientActions: [],
    bwildActions: [],
    nextStep: null,
    materials: [],
    faq: [],
    remaining: null,
  };

  if (!description) return result;

  // Try to split by markdown headers
  const hasHeaders = /(?:^|\n)#+\s/.test(description);

  if (hasHeaders) {
    // Split into sections by headers
    const parts = description.split(/(?=(?:^|\n)#+\s)/);
    const _matched = new Set<number>();

    for (const part of parts) {
      let found = false;
      for (const { key, regex } of sectionPatterns) {
        if (regex.test(part)) {
          const content = part.replace(/^[#\s]+[^\n]*\n?/, "").trim();
          if (key === "objective" || key === "nextStep") {
            (result[key] as string | null) = content;
          } else {
            (result[key] as string[]) = toBullets(content);
          }
          found = true;
          break;
        }
      }
      if (!found) {
        const trimmed = part.replace(/^[#\s]+[^\n]*\n?/, "").trim();
        if (trimmed) {
          result.remaining = result.remaining
            ? result.remaining + "\n" + trimmed
            : trimmed;
        }
      }
    }
  } else {
    // No markdown headers — show as objective (single block)
    result.objective = description.trim();
  }

  return result;
}

/* ─── Section block component ─── */

interface SectionBlockProps {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  className?: string;
}

function SectionBlock({
  icon: Icon,
  title,
  children,
  className,
}: SectionBlockProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <h4 className="flex items-center gap-2 text-card-label">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        {title}
      </h4>
      <div className="pl-6">{children}</div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-1 list-none p-0 m-0">
      {items.map((item, i) => (
        <li key={i} className="text-body flex items-start gap-2">
          <span
            className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/40 shrink-0"
            aria-hidden
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ─── Main component ─── */

interface StageDetailsSectionsProps {
  stage: JourneyStage;
}

export function StageDetailsSections({ stage }: StageDetailsSectionsProps) {
  const sections = parseSections(stage.description);
  const _hasStructuredContent =
    sections.objective ||
    sections.clientActions.length > 0 ||
    sections.bwildActions.length > 0 ||
    sections.nextStep ||
    sections.materials.length > 0 ||
    sections.faq.length > 0;

  return (
    <div className="space-y-4">
      {/* ① Objetivo */}
      {sections.objective && (
        <SectionBlock icon={Target} title="Objetivo da etapa">
          <p className="text-body text-muted-foreground whitespace-pre-line">
            {sections.objective}
          </p>
        </SectionBlock>
      )}

      {/* Remaining unparsed description (fallback) */}
      {sections.remaining && (
        <div className="text-body text-muted-foreground whitespace-pre-line leading-relaxed">
          {sections.remaining}
        </div>
      )}

      {/* ② O que você precisa fazer */}
      {sections.clientActions.length > 0 && (
        <SectionBlock
          icon={ClipboardCheck}
          title="O que você precisa fazer agora"
        >
          <BulletList items={sections.clientActions} />
        </SectionBlock>
      )}

      {/* ③ O que a Bwild está fazendo */}
      {sections.bwildActions.length > 0 && (
        <SectionBlock icon={Wrench} title="O que a Bwild está fazendo">
          <BulletList items={sections.bwildActions} />
        </SectionBlock>
      )}

      {/* ④ O que vem depois */}
      {sections.nextStep && (
        <SectionBlock icon={ArrowRight} title="O que vem depois">
          <p className="text-body text-muted-foreground">{sections.nextStep}</p>
        </SectionBlock>
      )}

      {/* ⑤ Materiais necessários */}
      {sections.materials.length > 0 && (
        <SectionBlock icon={Package} title="Materiais necessários">
          <BulletList items={sections.materials} />
        </SectionBlock>
      )}

      {/* ⑥ Dúvidas comuns */}
      {sections.faq.length > 0 && (
        <SectionBlock icon={HelpCircle} title="Dúvidas comuns">
          <BulletList items={sections.faq} />
        </SectionBlock>
      )}

      {/* Warning */}
      {stage.warning_text && (
        <Alert
          variant="destructive"
          className="bg-[hsl(var(--warning-light))] border-[hsl(var(--warning)/0.3)] text-[hsl(var(--warning))]"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {stage.warning_text}
          </AlertDescription>
        </Alert>
      )}

      {/* Dependencies */}
      {stage.dependencies_text && (
        <Alert className="bg-[hsl(var(--info-light))] border-[hsl(var(--info)/0.3)]">
          <Lock className="h-4 w-4 text-[hsl(var(--info))]" />
          <AlertDescription className="text-[hsl(var(--info))] text-sm">
            <span className="font-medium">Depende de:</span>{" "}
            {stage.dependencies_text}
          </AlertDescription>
        </Alert>
      )}

      {/* Revision text */}
      {stage.revision_text && (
        <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <span>
            <span className="font-medium">Revisões:</span> {stage.revision_text}
          </span>
        </div>
      )}
    </div>
  );
}
