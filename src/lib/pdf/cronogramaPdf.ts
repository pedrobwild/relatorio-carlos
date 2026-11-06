/**
 * cronogramaPdf: Cronograma de obra em PDF no padrão visual Bewild.
 *
 * A4 retrato, 4 seções:
 *   1. Capa (logo, obra, cliente, início, entrega prevista, revisão, emissão)
 *   2. Cronograma em barras por semana (folga em tom neutro, feriados, entrega)
 *   3. O que acontece em cada semana (linguagem para o cliente)
 *   4. Acompanhamento (Bwild Workflow, observações, rodapé escuro)
 *
 * Fontes Playfair Display e Poppins e as logos são embutidas no PDF. Se não
 * puderem ser carregadas (ex.: testes em jsdom), cai para Helvetica sem logo.
 * `jspdf` é carregado sob demanda para não pesar o bundle inicial.
 */

import type { ProjectActivity } from "@/hooks/useProjectActivities";
import { isHoliday } from "@/lib/businessDays";
import { parseLocalDate } from "@/lib/activityStatus";
import { CRONOGRAMA_PDF_COPY as COPY } from "@/content/cronogramaPdf";
import { SLACK_DESCRIPTION } from "@/lib/schedule/weeklySchedule";

type RGB = [number, number, number];
const C = {
  bg: [240, 244, 245] as RGB, // #F0F4F5
  text: [22, 24, 27] as RGB, // #16181B
  primary: [1, 51, 91] as RGB, // #01335B
  accent: [1, 64, 117] as RGB, // #014075
  navy: [10, 17, 30] as RGB, // #0A111E
  neutral1: [228, 236, 241] as RGB, // #E4ECF1
  neutral2: [211, 224, 234] as RGB, // #D3E0EA
  line: [198, 211, 220] as RGB, // #C6D3DC
  muted: [90, 104, 116] as RGB, // #5A6874
  darkText: [219, 230, 240] as RGB, // #DBE6F0
  darkNum: [157, 187, 220] as RGB, // #9DBBDC
};

const PAGE_W = 210;
const PAGE_H = 297;
const M = 18;

export interface CronogramaPdfProject {
  id?: string;
  name: string;
  unit_name?: string | null;
  nome_do_empreendimento?: string | null;
  customer_name?: string | null;
  address?: string | null;
  endereco_completo?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  /** Revisão do cronograma (R0, R1...). */
  schedule_revision?: number | null;
  /** Entrega prevista na exportação anterior (para a frase da revisão). */
  previous_delivery?: string | null;
}

export interface CronogramaPdfOptions {
  now?: Date;
  fileName?: string;
  /** "planned" = só o planejado; "comparison" = mostra também o realizado. */
  mode?: "planned" | "comparison";
  /** Desliga o carregamento de fontes e logos (testes). */
  skipAssets?: boolean;
}

export class CronogramaPdfEmptyError extends Error {
  constructor() {
    super(COPY.errors.empty);
    this.name = "CronogramaPdfEmptyError";
  }
}

/** Slug compatível com nomes de arquivo: minúsculo, sem acento, hífens. */
export function slugifyForFilename(input: string | null | undefined): string {
  const slug = (input ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "obra";
}

function filePart(input: string | null | undefined): string {
  return (input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function empreendimentoOf(p: CronogramaPdfProject): string {
  return p.nome_do_empreendimento?.trim() || p.name;
}

/** `Cronograma-Bewild-<empreendimento>-<unidade>-R<n>.pdf` */
export function buildCronogramaFileName(p: CronogramaPdfProject): string {
  const parts = [
    "Cronograma-Bewild",
    filePart(empreendimentoOf(p)) || "Obra",
    filePart(p.unit_name),
    `R${p.schedule_revision ?? 0}`,
  ].filter(Boolean);
  return `${parts.join("-")}.pdf`;
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "a definir";
  const d = parseLocalDate(value);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function fmtShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function sortActivities(activities: ProjectActivity[]): ProjectActivity[] {
  return [...activities].sort((a, b) => {
    const sa = a.planned_start ?? "";
    const sb = b.planned_start ?? "";
    if (sa === sb) return a.sort_order - b.sort_order;
    return sa < sb ? -1 : 1;
  });
}

/** Datas de início e entrega prevista a partir das atividades. */
export function scheduleBounds(activities: ProjectActivity[]): {
  start: string | null;
  end: string | null;
} {
  let start: string | null = null;
  let end: string | null = null;
  for (const a of activities) {
    if (a.planned_start && (!start || a.planned_start < start)) start = a.planned_start;
    if (a.planned_end && (!end || a.planned_end > end)) end = a.planned_end;
  }
  return { start, end };
}

/** Remove travessões e termos internos do texto mostrado ao cliente. */
export function clientSafe(text: string): string {
  return text
    .replace(/\s*[\u2014\u2013]\s*/g, ", ")
    .replace(/\bsetup\b/gi, "preparação")
    .trim();
}

function isSlack(a: ProjectActivity): boolean {
  return a.description.trim() === SLACK_DESCRIPTION;
}

// ── Assets ──────────────────────────────────────────────────────────────
interface Assets {
  fonts: boolean;
  logoBlue: string | null;
  logoWhite: string | null;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function fetchB64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`asset ${res.status}`);
  return toBase64(await res.arrayBuffer());
}

async function loadAssets(doc: import("jspdf").jsPDF): Promise<Assets> {
  const out: Assets = { fonts: false, logoBlue: null, logoWhite: null };
  try {
    const [pf, pr, pm, ps] = await Promise.all([
      import("@/assets/fonts/PlayfairDisplay-Bold.ttf?url"),
      import("@/assets/fonts/Poppins-Regular.ttf?url"),
      import("@/assets/fonts/Poppins-Medium.ttf?url"),
      import("@/assets/fonts/Poppins-SemiBold.ttf?url"),
    ]);
    const files: [string, string, string, string][] = [
      [pf.default, "PlayfairDisplay-Bold.ttf", "Playfair", "bold"],
      [pr.default, "Poppins-Regular.ttf", "Poppins", "normal"],
      [pm.default, "Poppins-Medium.ttf", "PoppinsMedium", "normal"],
      [ps.default, "Poppins-SemiBold.ttf", "Poppins", "bold"],
    ];
    const data = await Promise.all(files.map(([u]) => fetchB64(u)));
    files.forEach(([, file, family, style], i) => {
      doc.addFileToVFS(file, data[i]);
      doc.addFont(file, family, style);
    });
    out.fonts = true;
  } catch {
    out.fonts = false;
  }
  try {
    const [b, w] = await Promise.all([
      import("@/assets/bewild-logo-blue.png?url"),
      import("@/assets/bewild-logo-white.png?url"),
    ]);
    const [bb, wb] = await Promise.all([fetchB64(b.default), fetchB64(w.default)]);
    out.logoBlue = `data:image/png;base64,${bb}`;
    out.logoWhite = `data:image/png;base64,${wb}`;
  } catch {
    /* sem logo */
  }
  return out;
}

// ── Desenho ────────────────────────────────────────────────────────────
type Doc = import("jspdf").jsPDF;

function makeFonts(doc: Doc, a: Assets) {
  return {
    title: (size: number) => {
      doc.setFont(a.fonts ? "Playfair" : "helvetica", "bold");
      doc.setFontSize(size);
    },
    body: (size: number) => {
      doc.setFont(a.fonts ? "Poppins" : "helvetica", "normal");
      doc.setFontSize(size);
    },
    medium: (size: number) => {
      doc.setFont(a.fonts ? "PoppinsMedium" : "helvetica", a.fonts ? "normal" : "bold");
      doc.setFontSize(size);
    },
    semi: (size: number) => {
      doc.setFont(a.fonts ? "Poppins" : "helvetica", "bold");
      doc.setFontSize(size);
    },
  };
}

const LOGO_RATIO = 200 / 640;

function paintBg(doc: Doc) {
  doc.setFillColor(...C.bg);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
}

function innerHeader(doc: Doc, a: Assets, f: ReturnType<typeof makeFonts>, title: string, subtitle: string) {
  paintBg(doc);
  if (a.logoBlue) doc.addImage(a.logoBlue, "PNG", M, 12, 28, 28 * LOGO_RATIO);
  f.body(8);
  doc.setTextColor(...C.muted);
  doc.text(subtitle, PAGE_W - M, 16, { align: "right" });
  f.title(20);
  doc.setTextColor(...C.primary);
  doc.text(title, M, 34);
  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.3);
  doc.line(M, 38, PAGE_W - M, 38);
}

export interface GeneratedCronogramaPdf {
  doc: Doc;
  fileName: string;
  start: string | null;
  end: string | null;
}

export async function generateCronogramaPdf(
  project: CronogramaPdfProject,
  activities: ProjectActivity[],
  options: CronogramaPdfOptions = {},
): Promise<GeneratedCronogramaPdf> {
  if (!activities || activities.length === 0) throw new CronogramaPdfEmptyError();
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const assets: Assets = options.skipAssets
    ? { fonts: false, logoBlue: null, logoWhite: null }
    : await loadAssets(doc);
  const f = makeFonts(doc, assets);

  const now = options.now ?? new Date();
  const rows = sortActivities(activities).filter((a) => a.planned_start && a.planned_end);
  if (rows.length === 0) throw new CronogramaPdfEmptyError();
  const { start, end } = scheduleBounds(rows);
  const revision = project.schedule_revision ?? 0;
  const emp = empreendimentoOf(project);
  const subtitle = [emp, project.unit_name ? `Unidade ${project.unit_name}` : null]
    .filter(Boolean)
    .join(", ");
  const comparison = options.mode === "comparison";

  // ── 1. Capa ──
  paintBg(doc);
  if (assets.logoBlue) doc.addImage(assets.logoBlue, "PNG", M, 24, 52, 52 * LOGO_RATIO);
  f.medium(9);
  doc.setTextColor(...C.accent);
  doc.text(COPY.cover.eyebrow.toUpperCase(), M, 92);
  f.title(36);
  doc.setTextColor(...C.primary);
  doc.text(COPY.cover.title, M, 108);
  f.semi(15);
  doc.setTextColor(...C.text);
  doc.text(doc.splitTextToSize(emp, PAGE_W - 2 * M), M, 124);
  if (project.unit_name) {
    f.body(12);
    doc.setTextColor(...C.muted);
    doc.text(`Unidade ${project.unit_name}`, M, 133);
  }
  if (project.customer_name) {
    f.body(11);
    doc.setTextColor(...C.text);
    doc.text(`${COPY.cover.client}: ${project.customer_name}`, M, 145);
  }
  // Bloco de informações
  const info: [string, string][] = [
    [COPY.cover.start, fmtDate(start)],
    [COPY.cover.delivery, fmtDate(end)],
    [COPY.cover.revision, `R${revision}`],
    [COPY.cover.issued, fmtDate(toIso(now))],
  ];
  const boxY = 170;
  const boxW = (PAGE_W - 2 * M - 6) / 2;
  info.forEach(([label, value], i) => {
    const x = M + (i % 2) * (boxW + 6);
    const y = boxY + Math.floor(i / 2) * 28;
    doc.setFillColor(...(i === 1 ? C.primary : C.neutral1));
    doc.roundedRect(x, y, boxW, 23, 2, 2, "F");
    f.body(8);
    doc.setTextColor(...(i === 1 ? C.darkText : C.muted));
    doc.text(label, x + 5, y + 8);
    f.semi(15);
    doc.setTextColor(...(i === 1 ? [255, 255, 255] as RGB : C.primary));
    doc.text(value, x + 5, y + 17);
  });
  if (revision > 0 && project.previous_delivery && end && project.previous_delivery !== end) {
    f.body(10);
    doc.setTextColor(...C.accent);
    doc.text(
      COPY.cover.revisionChange(fmtDate(project.previous_delivery), fmtDate(end)),
      M,
      boxY + 64,
    );
  }

  // ── 2. Barras ──
  const t0 = parseLocalDate(start!).getTime();
  const t1 = parseLocalDate(end!).getTime() + 86400000;
  const labelW = 46;
  const chartX = M + labelW;
  const chartW = PAGE_W - M - chartX;
  const xOf = (iso: string, endOfDay = false) =>
    chartX + ((parseLocalDate(iso).getTime() + (endOfDay ? 86400000 : 0) - t0) / (t1 - t0)) * chartW;
  const holidays: Date[] = [];
  for (let d = new Date(t0); d.getTime() < t1; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6 && isHoliday(d)) holidays.push(new Date(d));
  }
  const rowH = Math.min(11, Math.max(8, 215 / rows.length));
  const perPage = Math.floor(215 / rowH);
  for (let p = 0; p * perPage < rows.length; p++) {
    doc.addPage();
    innerHeader(doc, assets, f, COPY.bars.title, subtitle);
    const top = 50;
    const slice = rows.slice(p * perPage, (p + 1) * perPage);
    const chartBottom = top + slice.length * rowH;
    // feriados
    doc.setDrawColor(...C.line);
    doc.setLineDashPattern([0.8, 0.8], 0);
    holidays.forEach((h) => {
      const x = xOf(toIso(h)) + (chartW / ((t1 - t0) / 86400000)) / 2;
      doc.line(x, top - 2, x, chartBottom);
    });
    doc.setLineDashPattern([], 0);
    slice.forEach((a, i) => {
      const y = top + i * rowH;
      if (i % 2 === 0) {
        doc.setFillColor(...C.neutral1);
        doc.rect(M, y, PAGE_W - 2 * M, rowH, "F");
      }
      f.semi(8);
      doc.setTextColor(...C.text);
      doc.text(a.etapa?.trim() || `Etapa ${p * perPage + i + 1}`, M + 2, y + rowH / 2 - 0.5);
      f.body(7);
      doc.setTextColor(...C.muted);
      doc.text(
        `${fmtShort(parseLocalDate(a.planned_start))} a ${fmtShort(parseLocalDate(a.planned_end))}`,
        M + 2,
        y + rowH / 2 + 3,
      );
      const x0 = xOf(a.planned_start);
      const x1 = xOf(a.planned_end, true);
      doc.setFillColor(...(isSlack(a) ? C.neutral2 : C.primary));
      doc.roundedRect(x0, y + 2, Math.max(1.5, x1 - x0), rowH - 4, 1, 1, "F");
      if (comparison && a.actual_start) {
        const ax0 = xOf(a.actual_start);
        const ax1 = xOf(a.actual_end ?? toIso(now), true);
        doc.setFillColor(...C.darkNum);
        doc.rect(ax0, y + rowH - 2.6, Math.max(1, Math.min(ax1, chartX + chartW) - ax0), 1.2, "F");
      }
    });
    // entrega prevista
    const xe = xOf(end!, true);
    doc.setDrawColor(...C.accent);
    doc.setLineWidth(0.6);
    doc.line(xe, top - 4, xe, chartBottom + 2);
    f.semi(8);
    doc.setTextColor(...C.accent);
    doc.text(`${COPY.bars.delivery} ${fmtDate(end)}`, Math.min(xe, PAGE_W - M), chartBottom + 7, {
      align: "right",
    });
    // legenda
    const ly = PAGE_H - 22;
    f.body(7.5);
    doc.setTextColor(...C.muted);
    doc.setFillColor(...C.primary);
    doc.rect(M, ly - 2.5, 5, 3, "F");
    doc.text(COPY.bars.legendWork, M + 7, ly);
    doc.setFillColor(...C.neutral2);
    doc.rect(M + 40, ly - 2.5, 5, 3, "F");
    doc.text(COPY.bars.legendSlack, M + 47, ly);
    if (comparison) {
      doc.setFillColor(...C.darkNum);
      doc.rect(M + 95, ly - 1.5, 5, 1.2, "F");
      doc.text(COPY.bars.legendActual, M + 102, ly);
    }
    if (holidays.length) {
      doc.text(
        `${COPY.bars.holidays}: ${holidays.map(fmtShort).join(", ")}`,
        M,
        ly + 5,
        { maxWidth: PAGE_W - 2 * M },
      );
    }
  }

  // ── 3. Semana a semana ──
  doc.addPage();
  innerHeader(doc, assets, f, COPY.weeks.title, subtitle);
  let y = 50;
  rows.forEach((a, i) => {
    const desc = clientSafe(a.description);
    f.body(9.5);
    const lines = doc.splitTextToSize(desc, PAGE_W - 2 * M - 14) as string[];
    const h = 7 + lines.length * 4.6;
    if (y + h > PAGE_H - 20) {
      doc.addPage();
      innerHeader(doc, assets, f, COPY.weeks.title, subtitle);
      y = 50;
    }
    doc.setFillColor(...(isSlack(a) ? C.neutral2 : C.primary));
    doc.circle(M + 4, y + 1.5, 4, "F");
    f.semi(8);
    doc.setTextColor(...(isSlack(a) ? C.primary : [255, 255, 255] as RGB));
    doc.text(String(i + 1), M + 4, y + 2.8, { align: "center" });
    f.semi(9.5);
    doc.setTextColor(...C.text);
    doc.text(
      `${a.etapa?.trim() || `Etapa ${i + 1}`}, ${fmtDate(a.planned_start)} a ${fmtDate(a.planned_end)}`,
      M + 12,
      y + 2.8,
    );
    f.body(9.5);
    doc.setTextColor(...C.muted);
    doc.text(lines, M + 12, y + 8);
    y += h + 3;
  });

  // ── 4. Acompanhamento ──
  doc.addPage();
  innerHeader(doc, assets, f, COPY.follow.title, subtitle);
  y = 52;
  f.body(10.5);
  doc.setTextColor(...C.text);
  for (const para of COPY.follow.paragraphs) {
    const lines = doc.splitTextToSize(para, PAGE_W - 2 * M) as string[];
    doc.text(lines, M, y);
    y += lines.length * 5.2 + 5;
  }
  y += 2;
  f.title(13);
  doc.setTextColor(...C.primary);
  doc.text(COPY.follow.channelsTitle, M, y);
  y += 7;
  f.body(10);
  doc.setTextColor(...C.text);
  for (const c of COPY.follow.channels) {
    doc.text(`•  ${c}`, M, y);
    y += 6;
  }
  y += 4;
  f.title(13);
  doc.setTextColor(...C.primary);
  doc.text(COPY.follow.notesTitle, M, y);
  y += 7;
  f.body(10);
  doc.setTextColor(...C.text);
  for (const n of COPY.follow.notes) {
    const lines = doc.splitTextToSize(`•  ${n}`, PAGE_W - 2 * M) as string[];
    doc.text(lines, M, y);
    y += lines.length * 5.2 + 2;
  }
  // rodapé escuro
  const fy = PAGE_H - 46;
  doc.setFillColor(...C.primary);
  doc.rect(0, fy, PAGE_W, PAGE_H - fy, "F");
  if (assets.logoWhite) doc.addImage(assets.logoWhite, "PNG", M, fy + 12, 40, 40 * LOGO_RATIO);
  f.body(9);
  doc.setTextColor(...C.darkText);
  doc.text(COPY.follow.footer, PAGE_W - M, fy + 17, { align: "right" });
  f.semi(9);
  doc.setTextColor(...C.darkNum);
  doc.text(`R${revision}  ·  ${fmtDate(toIso(now))}`, PAGE_W - M, fy + 24, { align: "right" });

  // numeração (exceto capa)
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    f.body(7.5);
    doc.setTextColor(...(i === total ? C.darkText : C.muted));
    doc.text(`${COPY.page} ${i} de ${total}`, PAGE_W / 2, PAGE_H - 8, { align: "center" });
  }

  return {
    doc,
    fileName: options.fileName ?? buildCronogramaFileName(project),
    start,
    end,
  };
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
