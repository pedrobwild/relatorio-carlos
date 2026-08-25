/**
 * Comparação entre duas versões salvas do relatório semanal.
 *
 * Usada no histórico de versões para mostrar exatamente o que mudou entre
 * dois salvamentos — palavra a palavra nos textos e item a item nas listas e
 * na galeria — antes de restaurar qualquer coisa.
 */

import type {
  WeeklyReportData,
  GalleryPhoto,
  LookaheadTask,
  RiskIssue,
  ClientDecision,
  Incident,
} from "@/types/weeklyReport";

export type TextDiffToken = {
  type: "equal" | "added" | "removed";
  value: string;
};

/** Remove tags do editor rich text para comparar apenas o conteúdo legível. */
export function stripHtml(html: string | null | undefined): string {
  return (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/**
 * Diff por palavra usando LCS. Textos de relatório são curtos (algumas
 * centenas de palavras), então o custo O(n*m) é irrelevante aqui.
 */
export function diffWords(before: string, after: string): TextDiffToken[] {
  const a = before.length ? before.split(/(\s+)/) : [];
  const b = after.length ? after.split(/(\s+)/) : [];

  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const tokens: TextDiffToken[] = [];
  const push = (type: TextDiffToken["type"], value: string) => {
    const last = tokens[tokens.length - 1];
    if (last && last.type === type) last.value += value;
    else tokens.push({ type, value });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("equal", a[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push("removed", a[i]);
      i++;
    } else {
      push("added", b[j]);
      j++;
    }
  }
  while (i < n) push("removed", a[i++]);
  while (j < m) push("added", b[j++]);

  return tokens.filter((t) => t.value.length > 0);
}

export interface TextSectionDiff {
  kind: "text";
  label: string;
  tokens: TextDiffToken[];
  changed: boolean;
}

export interface ListItemChange {
  label: string;
  before?: string;
  after?: string;
}

export interface ListSectionDiff {
  kind: "list";
  label: string;
  added: string[];
  removed: string[];
  changed: ListItemChange[];
}

export interface PhotoChange {
  id: string;
  url: string;
  caption: string;
  area: string;
  /** Campos alterados, já com rótulo pronto para exibição. */
  fields?: ListItemChange[];
}

export interface PhotoSectionDiff {
  added: PhotoChange[];
  removed: PhotoChange[];
  changed: PhotoChange[];
}

export interface ReportVersionDiff {
  textSections: TextSectionDiff[];
  listSections: ListSectionDiff[];
  photos: PhotoSectionDiff;
  hasChanges: boolean;
}

type Identifiable = { id: string };

function describeLookahead(t: LookaheadTask): string {
  return [t.date, t.description, t.responsible].filter(Boolean).join(" · ");
}
function describeRisk(r: RiskIssue): string {
  return [r.title, r.severity, r.status].filter(Boolean).join(" · ");
}
function describeDecision(d: ClientDecision): string {
  return [d.description, d.dueDate, d.status].filter(Boolean).join(" · ");
}
function describeIncident(i: Incident): string {
  return [i.occurrence, i.occurrenceDate, i.status].filter(Boolean).join(" · ");
}

function diffList<T extends Identifiable>(
  label: string,
  before: T[] | undefined,
  after: T[] | undefined,
  describe: (item: T) => string,
): ListSectionDiff {
  const beforeById = new Map((before ?? []).map((i) => [i.id, i]));
  const afterById = new Map((after ?? []).map((i) => [i.id, i]));

  const added: string[] = [];
  const removed: string[] = [];
  const changed: ListItemChange[] = [];

  for (const [id, item] of afterById) {
    const prev = beforeById.get(id);
    if (!prev) {
      added.push(describe(item));
      continue;
    }
    const prevText = describe(prev);
    const nextText = describe(item);
    if (JSON.stringify(prev) !== JSON.stringify(item)) {
      changed.push({ label: nextText, before: prevText, after: nextText });
    }
  }
  for (const [id, item] of beforeById) {
    if (!afterById.has(id)) removed.push(describe(item));
  }

  return { kind: "list", label, added, removed, changed };
}

function toPhotoChange(photo: GalleryPhoto): PhotoChange {
  return {
    id: photo.id,
    url: photo.url ?? "",
    caption: photo.caption?.trim() ?? "",
    area: photo.area?.trim() ?? "",
  };
}

function diffPhotos(
  before: GalleryPhoto[] | undefined,
  after: GalleryPhoto[] | undefined,
): PhotoSectionDiff {
  const key = (p: GalleryPhoto) => p.path ?? p.id;
  const beforeByKey = new Map((before ?? []).map((p) => [key(p), p]));
  const afterByKey = new Map((after ?? []).map((p) => [key(p), p]));

  const added: PhotoChange[] = [];
  const removed: PhotoChange[] = [];
  const changed: PhotoChange[] = [];

  for (const [k, photo] of afterByKey) {
    const prev = beforeByKey.get(k);
    if (!prev) {
      added.push(toPhotoChange(photo));
      continue;
    }
    const fields: ListItemChange[] = [];
    const compare = (label: string, a?: string, b?: string) => {
      if ((a ?? "").trim() !== (b ?? "").trim()) {
        fields.push({ label, before: a?.trim() || "—", after: b?.trim() || "—" });
      }
    };
    compare("Legenda", prev.caption, photo.caption);
    compare("Ambiente", prev.area, photo.area);
    compare("Data", prev.date, photo.date);
    compare("Categoria", prev.category, photo.category);
    if (fields.length > 0) changed.push({ ...toPhotoChange(photo), fields });
  }
  for (const [k, photo] of beforeByKey) {
    if (!afterByKey.has(k)) removed.push(toPhotoChange(photo));
  }

  return { added, removed, changed };
}

/**
 * @param before versão mais antiga (base da comparação)
 * @param after versão mais recente
 */
export function diffReportVersions(
  before: WeeklyReportData | null | undefined,
  after: WeeklyReportData | null | undefined,
): ReportVersionDiff {
  const a = before ?? null;
  const b = after ?? null;

  const summaryTokens = diffWords(
    stripHtml(a?.executiveSummary),
    stripHtml(b?.executiveSummary),
  );
  const textSections: TextSectionDiff[] = [
    {
      kind: "text",
      label: "Resumo executivo",
      tokens: summaryTokens,
      changed: summaryTokens.some((t) => t.type !== "equal"),
    },
  ];

  const listSections: ListSectionDiff[] = [
    diffList("Próximas atividades", a?.lookaheadTasks, b?.lookaheadTasks, describeLookahead),
    diffList("Riscos e problemas", a?.risksAndIssues, b?.risksAndIssues, describeRisk),
    diffList("Decisões do cliente", a?.clientDecisions, b?.clientDecisions, describeDecision),
    diffList("Ocorrências", a?.incidents, b?.incidents, describeIncident),
  ].filter(
    (s) => s.added.length > 0 || s.removed.length > 0 || s.changed.length > 0,
  );

  const photos = diffPhotos(a?.gallery, b?.gallery);

  const hasChanges =
    textSections.some((s) => s.changed) ||
    listSections.length > 0 ||
    photos.added.length > 0 ||
    photos.removed.length > 0 ||
    photos.changed.length > 0;

  return { textSections, listSections, photos, hasChanges };
}
