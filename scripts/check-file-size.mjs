#!/usr/bin/env node
/**
 * File-size governance check (Bloco 7 — issue #24).
 *
 * Thresholds:
 *   - src/pages/**       warn ≥ 400 lines, fail ≥ 600 lines
 *   - src/components/**  warn ≥ 500 lines, fail ≥ 600 lines
 *
 * Usage:
 *   node scripts/check-file-size.mjs            # full repo scan
 *   node scripts/check-file-size.mjs --strict   # exit 1 on any warning
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

const RULES = [
  { dir: 'src/pages', warn: 400, fail: 600 },
  { dir: 'src/components', warn: 500, fail: 600 },
];

const IGNORE_DIRS = new Set(['__tests__', 'ui', 'node_modules', 'dist']);

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      yield* walk(join(dir, entry.name));
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
      yield join(dir, entry.name);
    }
  }
}

function countLines(path) {
  try {
    return readFileSync(path, 'utf8').split('\n').length;
  } catch {
    return 0;
  }
}

function check() {
  const findings = [];
  for (const rule of RULES) {
    const abs = join(ROOT, rule.dir);
    try {
      if (!statSync(abs).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const file of walk(abs)) {
      const lines = countLines(file);
      if (lines >= rule.fail) {
        findings.push({ path: relative(ROOT, file), lines, level: 'fail', rule });
      } else if (lines >= rule.warn) {
        findings.push({ path: relative(ROOT, file), lines, level: 'warn', rule });
      }
    }
  }
  findings.sort((a, b) => b.lines - a.lines);
  return findings;
}

function format(f) {
  const icon = f.level === 'fail' ? 'FAIL' : 'WARN';
  return `[${icon}] ${f.path}: ${f.lines} linhas (limite warn=${f.rule.warn}, fail=${f.rule.fail})`;
}

const strict = process.argv.includes('--strict');
const findings = check();

if (findings.length === 0) {
  console.log('OK: nenhum arquivo acima dos limites de tamanho.');
  process.exit(0);
}

console.log('Arquivos acima dos limites de tamanho:\n');
for (const f of findings) console.log(format(f));

const failures = findings.filter(f => f.level === 'fail').length;
const warnings = findings.filter(f => f.level === 'warn').length;
console.log(`\nResumo: ${failures} fail, ${warnings} warn.`);

if (failures > 0 || (strict && warnings > 0)) {
  process.exit(1);
}
process.exit(0);
