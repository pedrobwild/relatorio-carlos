/**
 * Auditoria de strings literais em PT-BR dentro de JSX.
 *
 * Detecta texto hard-coded em componentes (`src/**\/*.tsx`) que deveria
 * morar nos arquivos centralizados de copy em `src/content/`.
 *
 * Heurística (regex puro — não usa AST para manter o script trivial):
 *   1. Captura `>...< ` (texto entre tags JSX)
 *   2. Captura `="..."` em props que costumam carregar copy
 *      (`title=`, `label=`, `placeholder=`, `aria-label=`, `description=`)
 *   3. Filtra: vazios, ASCII puro sem acentos e sem espaço, classes Tailwind,
 *      identificadores (`Foo Bar` em PascalCase de uma palavra), URLs, números.
 *
 * Saída: `docs/strings-orfas.md` com tabela `arquivo:linha | trecho`.
 *
 * Uso:
 *   npx tsx scripts/audit-strings.ts            # gera relatório
 *   npx tsx scripts/audit-strings.ts --check N  # falha se >N novas strings
 *
 * O modo `--check` é pensado pra step de CI: sirve como guard-rail
 * crescente, não como bloqueio total (legado é grande demais).
 */

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const SRC_DIR = join(ROOT, 'src');
const REPORT_PATH = join(ROOT, 'docs', 'strings-orfas.md');

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '__tests__',
  'test',
  'tests',
  'ui',          // shadcn primitives
  'content',     // arquivos de copy — fonte da verdade
]);

const IGNORED_FILE_SUFFIXES = ['.test.tsx', '.spec.tsx', '.stories.tsx', '.d.ts'];

/** Caracteres que indicam string em PT-BR (acento, cedilha, til) */
const PT_BR_HINT = /[áàâãéêíóôõúüç]/i;

/** Props HTML/JSX que carregam copy visível ao usuário. */
const COPY_PROPS = [
  'title',
  'label',
  'placeholder',
  'aria-label',
  'description',
  'tooltip',
  'helperText',
  'emptyMessage',
];

interface Finding {
  file: string;
  line: number;
  snippet: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (full.endsWith('.tsx') && !IGNORED_FILE_SUFFIXES.some((s) => full.endsWith(s))) {
      out.push(full);
    }
  }
  return out;
}

function isLikelyCopy(raw: string): boolean {
  const text = raw.trim();
  if (text.length < 4) return false;
  if (!/\s/.test(text) && !PT_BR_HINT.test(text)) return false; // single token, no accent
  if (/^[A-Z_]+$/.test(text)) return false; // SCREAMING_CASE
  if (/^[a-z][a-zA-Z0-9]*$/.test(text)) return false; // camelCase identifier
  if (/^\d+([.,]\d+)?$/.test(text)) return false; // number
  if (/^https?:\/\//.test(text)) return false;
  if (/^\/[\w-/]+$/.test(text)) return false; // route
  if (/^\{.*\}$/.test(text)) return false; // already interpolation
  if (/^[#.][\w-]+/.test(text)) return false; // selector
  if (/^[a-z-]+(\s[a-z-]+)*$/.test(text) && !PT_BR_HINT.test(text)) return false; // tailwind classes
  if (!PT_BR_HINT.test(text) && !/\s/.test(text)) return false;
  return true;
}

function scanFile(file: string): Finding[] {
  const findings: Finding[] = [];
  const content = readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  // 1. Texto entre tags JSX: >Texto<
  // 2. Props com copy: title="Texto" etc.
  const tagTextRe = />([^<>{}\n][^<>{}\n]+)</g;
  const propRe = new RegExp(`\\b(${COPY_PROPS.join('|')})="([^"]+)"`, 'g');

  lines.forEach((line, idx) => {
    let match: RegExpExecArray | null;

    tagTextRe.lastIndex = 0;
    while ((match = tagTextRe.exec(line)) !== null) {
      const raw = match[1];
      if (isLikelyCopy(raw)) {
        findings.push({ file, line: idx + 1, snippet: raw.trim() });
      }
    }

    propRe.lastIndex = 0;
    while ((match = propRe.exec(line)) !== null) {
      const raw = match[2];
      if (isLikelyCopy(raw)) {
        findings.push({ file, line: idx + 1, snippet: `${match[1]}="${raw}"` });
      }
    }
  });

  return findings;
}

function buildReport(findings: Finding[]): string {
  const grouped = new Map<string, Finding[]>();
  for (const f of findings) {
    const rel = relative(ROOT, f.file);
    if (!grouped.has(rel)) grouped.set(rel, []);
    grouped.get(rel)!.push(f);
  }

  const sortedFiles = [...grouped.keys()].sort();

  const lines: string[] = [];
  lines.push('# Strings órfãs — auditoria automática');
  lines.push('');
  lines.push(
    '> Gerado por `scripts/audit-strings.ts`. Estas strings estão hard-coded em JSX e deveriam',
    '> migrar pra `src/content/*Labels.ts` (ou similar). Ver `docs/TOM_DE_VOZ.md`.',
  );
  lines.push('');
  lines.push(`**Total:** ${findings.length} ocorrências em ${sortedFiles.length} arquivos.`);
  lines.push('');

  for (const file of sortedFiles) {
    const items = grouped.get(file)!;
    lines.push(`## \`${file}\` (${items.length})`);
    lines.push('');
    lines.push('| Linha | Trecho |');
    lines.push('|------:|--------|');
    for (const f of items) {
      const safe = f.snippet.replace(/\|/g, '\\|');
      lines.push(`| ${f.line} | \`${safe}\` |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const checkIdx = args.indexOf('--check');
  const checkThreshold = checkIdx >= 0 ? Number(args[checkIdx + 1]) : null;

  const files = walk(SRC_DIR);
  const findings: Finding[] = [];
  for (const file of files) {
    findings.push(...scanFile(file));
  }

  const report = buildReport(findings);
  writeFileSync(REPORT_PATH, report, 'utf8');
  console.warn(`[audit-strings] ${findings.length} ocorrências em ${files.length} arquivos`);
  console.warn(`[audit-strings] relatório: ${relative(ROOT, REPORT_PATH)}`);

  if (checkThreshold !== null && Number.isFinite(checkThreshold)) {
    if (findings.length > checkThreshold) {
      console.error(
        `[audit-strings] FALHA: ${findings.length} > limite ${checkThreshold}. ` +
          `Migre strings novas para src/content/.`,
      );
      process.exit(1);
    }
    console.warn(`[audit-strings] OK: ${findings.length} <= limite ${checkThreshold}`);
  }
}

if (existsSync(SRC_DIR)) {
  main();
} else {
  console.error(`[audit-strings] diretório não encontrado: ${SRC_DIR}`);
  process.exit(1);
}
