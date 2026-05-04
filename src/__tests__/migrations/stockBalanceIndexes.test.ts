import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Regression guard: ensure the partial unique indexes required by the
 * `apply_stock_movement_to_balance` trigger's ON CONFLICT clauses exist
 * in the migration history. Without these, stock entries fail with
 * "no unique or exclusion constraint matching the ON CONFLICT specification".
 */
describe('stock_balances partial unique indexes', () => {
  const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
  const sql = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
    .join('\n');

  it('defines uniq_balance_estoque (item_id WHERE estoque AND project_id IS NULL)', () => {
    const re =
      /CREATE\s+UNIQUE\s+INDEX[^;]*uniq_balance_estoque[^;]*\(\s*item_id\s*\)[^;]*WHERE[^;]*location_type\s*=\s*'estoque'[^;]*project_id\s+IS\s+NULL/is;
    expect(sql).toMatch(re);
  });

  it('defines uniq_balance_obra (item_id, project_id WHERE obra AND project_id IS NOT NULL)', () => {
    const re =
      /CREATE\s+UNIQUE\s+INDEX[^;]*uniq_balance_obra[^;]*\(\s*item_id\s*,\s*project_id\s*\)[^;]*WHERE[^;]*location_type\s*=\s*'obra'[^;]*project_id\s+IS\s+NOT\s+NULL/is;
    expect(sql).toMatch(re);
  });
});
