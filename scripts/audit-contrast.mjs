#!/usr/bin/env node
// @ts-check
/**
 * audit-contrast.mjs
 *
 * Lê os tokens HSL de `src/index.css` (blocos `:root` e `.dark`), calcula a
 * razão de contraste WCAG entre os pares relevantes (texto vs. fundo, ações
 * vs. fundo) e gera um relatório em Markdown salvo em `docs/DESIGN_TOKENS.md`.
 *
 * Falha o processo (exit 1) se algum par marcado como "obrigatório AA" não
 * passar 4.5:1 (texto normal) ou 3:1 (texto grande / componentes UI).
 *
 * Run: `npm run audit:contrast`
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CSS_PATH = resolve(ROOT, 'src/index.css');
const DOC_PATH = resolve(ROOT, 'docs/DESIGN_TOKENS.md');

// ─────────────────────────────────────────────────────────────────────────────
// HSL → RGB → relative luminance → contrast ratio (WCAG 2.1)
// ─────────────────────────────────────────────────────────────────────────────

/** @param {number} h @param {number} s @param {number} l */
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

/** @param {number} c */
function srgbChannel(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** @param {{r:number,g:number,b:number}} rgb */
function relativeLuminance({ r, g, b }) {
  return 0.2126 * srgbChannel(r) + 0.7152 * srgbChannel(g) + 0.0722 * srgbChannel(b);
}

/** @param {{r:number,g:number,b:number}} a @param {{r:number,g:number,b:number}} b */
function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

// ─────────────────────────────────────────────────────────────────────────────
// Token parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrai um bloco delimitado por `:root {` ou `.dark {` até o `}` correspondente
 * (uma chave de fechamento simples — o CSS do projeto usa formatação consistente).
 *
 * @param {string} css
 * @param {string} selector
 */
function extractBlock(css, selector) {
  const re = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`);
  const match = css.match(re);
  if (!match) throw new Error(`Bloco "${selector}" não encontrado em ${CSS_PATH}`);
  return match[1];
}

/**
 * Parseia linhas `--token: H S% L%;` para um mapa.
 * Ignora valores compostos (gradientes, shadows, etc.) — só captura tripletos HSL.
 *
 * @param {string} block
 */
function parseTokens(block) {
  /** @type {Record<string, {h:number,s:number,l:number}>} */
  const out = {};
  const re = /--([a-z0-9-]+):\s*(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*;/gi;
  let m;
  while ((m = re.exec(block)) !== null) {
    out[m[1]] = { h: parseFloat(m[2]), s: parseFloat(m[3]), l: parseFloat(m[4]) };
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pares a auditar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pares texto-fundo / componente-fundo. `kind` controla o limiar:
 *  - 'text'      → AA = 4.5:1 (texto normal < 18pt)
 *  - 'largeText' → AA = 3.0:1 (texto grande ≥ 18pt ou bold ≥ 14pt)
 *  - 'ui'        → AA = 3.0:1 (componentes UI / borda significante)
 *
 * @typedef {{ name: string; fg: string; bg: string; kind: 'text'|'largeText'|'ui'; required?: boolean }} Pair
 * @type {Pair[]}
 */
const PAIRS = [
  { name: 'foreground × background', fg: 'foreground', bg: 'background', kind: 'text', required: true },
  { name: 'foreground × surface', fg: 'foreground', bg: 'surface', kind: 'text' },
  { name: 'card-foreground × card', fg: 'card-foreground', bg: 'card', kind: 'text', required: true },
  { name: 'popover-foreground × popover', fg: 'popover-foreground', bg: 'popover', kind: 'text', required: true },
  { name: 'muted-foreground × background', fg: 'muted-foreground', bg: 'background', kind: 'text', required: true },
  { name: 'muted-foreground × muted', fg: 'muted-foreground', bg: 'muted', kind: 'text' },
  { name: 'primary-foreground × primary', fg: 'primary-foreground', bg: 'primary', kind: 'text', required: true },
  { name: 'secondary-foreground × secondary', fg: 'secondary-foreground', bg: 'secondary', kind: 'text', required: true },
  { name: 'accent-foreground × accent', fg: 'accent-foreground', bg: 'accent', kind: 'text', required: true },
  { name: 'success-foreground × success', fg: 'success-foreground', bg: 'success', kind: 'text', required: true },
  { name: 'info-foreground × info', fg: 'info-foreground', bg: 'info', kind: 'text', required: true },
  { name: 'warning-foreground × warning', fg: 'warning-foreground', bg: 'warning', kind: 'text', required: true },
  { name: 'destructive-foreground × destructive', fg: 'destructive-foreground', bg: 'destructive', kind: 'text', required: true },
  // UI / borda
  { name: 'border × background', fg: 'border', bg: 'background', kind: 'ui' },
  { name: 'ring × background', fg: 'ring', bg: 'background', kind: 'ui', required: true },
  // Sidebar
  { name: 'sidebar-foreground × sidebar-background', fg: 'sidebar-foreground', bg: 'sidebar-background', kind: 'text', required: true },
  { name: 'sidebar-primary-foreground × sidebar-primary', fg: 'sidebar-primary-foreground', bg: 'sidebar-primary', kind: 'text', required: true },
  { name: 'sidebar-accent-foreground × sidebar-accent', fg: 'sidebar-accent-foreground', bg: 'sidebar-accent', kind: 'text', required: true },
];

/** @param {'text'|'largeText'|'ui'} kind */
function thresholdFor(kind) {
  return kind === 'text' ? 4.5 : 3.0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

const css = readFileSync(CSS_PATH, 'utf8');
const lightTokens = parseTokens(extractBlock(css, ':root'));
const darkTokens = parseTokens(extractBlock(css, '\\.dark'));

/**
 * @param {Record<string, {h:number,s:number,l:number}>} tokens
 * @param {Record<string, {h:number,s:number,l:number}>} fallback
 * @param {string} key
 */
function resolveToken(tokens, fallback, key) {
  return tokens[key] ?? fallback[key];
}

/**
 * @param {Record<string, {h:number,s:number,l:number}>} tokens
 * @param {Record<string, {h:number,s:number,l:number}>} fallback
 */
function audit(tokens, fallback) {
  /** @type {{ pair: Pair; ratio: number; threshold: number; pass: boolean; missing: boolean }[]} */
  const rows = [];
  for (const pair of PAIRS) {
    const fgTok = resolveToken(tokens, fallback, pair.fg);
    const bgTok = resolveToken(tokens, fallback, pair.bg);
    if (!fgTok || !bgTok) {
      rows.push({ pair, ratio: 0, threshold: thresholdFor(pair.kind), pass: false, missing: true });
      continue;
    }
    const fgRgb = hslToRgb(fgTok.h, fgTok.s, fgTok.l);
    const bgRgb = hslToRgb(bgTok.h, bgTok.s, bgTok.l);
    const ratio = contrastRatio(fgRgb, bgRgb);
    const threshold = thresholdFor(pair.kind);
    rows.push({ pair, ratio, threshold, pass: ratio >= threshold, missing: false });
  }
  return rows;
}

const lightRows = audit(lightTokens, lightTokens);
// dark herda do :root quando o token não é redefinido
const darkRows = audit(darkTokens, lightTokens);

// ─────────────────────────────────────────────────────────────────────────────
// Render markdown
// ─────────────────────────────────────────────────────────────────────────────

/** @param {ReturnType<typeof audit>} rows */
function renderTable(rows) {
  const header = '| Par | Tipo | Ratio | Limiar AA | Status |\n|---|---|---:|---:|:---:|\n';
  const body = rows
    .map((r) => {
      const status = r.missing
        ? 'N/A (token não definido)'
        : r.pass
          ? 'PASS'
          : 'FAIL';
      const ratio = r.missing ? '—' : r.ratio.toFixed(2);
      return `| \`${r.pair.name}\` | ${r.pair.kind} | ${ratio} | ${r.threshold.toFixed(1)} | ${status} |`;
    })
    .join('\n');
  return header + body + '\n';
}

const md = `# Design Tokens — Contraste WCAG 2.1 AA

> Gerado automaticamente por \`scripts/audit-contrast.mjs\` a partir de
> \`src/index.css\`. Não edite manualmente — re-rode \`npm run audit:contrast\`
> após alterar tokens HSL.

Critérios:

- **Texto normal (kind=text):** AA exige ≥ **4.5:1** (WCAG 1.4.3).
- **Texto grande / componentes UI (kind=largeText|ui):** AA exige ≥ **3.0:1** (WCAG 1.4.11).
- Tokens marcados como \`required\` precisam passar — falha bloqueia o CI.

## Tema claro (\`:root\`)

${renderTable(lightRows)}

## Tema escuro (\`.dark\`)

Tokens não redefinidos em \`.dark\` herdam de \`:root\`.

${renderTable(darkRows)}

## Como ler

- **PASS / FAIL** considera o limiar do tipo do par.
- Pares com \`FAIL\` em \`required\` precisam ser ajustados antes do merge.
  Estratégia recomendada: alterar o **foreground** (ex.: \`muted-foreground\`)
  para preservar a paleta primária BWild.
- Pares com \`FAIL\` em não-required servem como aviso — corrigir quando
  possível, mas não bloqueiam o build.
`;

writeFileSync(DOC_PATH, md, 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// Console summary + exit code
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} label
 * @param {ReturnType<typeof audit>} rows
 */
function summarize(label, rows) {
  const required = rows.filter((r) => r.pair.required && !r.missing);
  const failed = required.filter((r) => !r.pass);
  console.log(`\n[${label}] ${required.length - failed.length}/${required.length} pares obrigatórios passaram AA`);
  for (const r of failed) {
    console.log(
      `  FAIL [${label}] ${r.pair.name} → ${r.ratio.toFixed(2)} (limiar ${r.threshold.toFixed(1)})`,
    );
  }
  return failed.length;
}

const failedLight = summarize('light', lightRows);
const failedDark = summarize('dark', darkRows);
const total = failedLight + failedDark;

console.log(`\nRelatório atualizado em ${DOC_PATH}`);

if (total > 0) {
  console.error(`\n${total} par(es) obrigatório(s) abaixo de AA. Ajuste os tokens em src/index.css.`);
  process.exit(1);
}

console.log('\nTodos os pares obrigatórios passam AA.');
