export const NC_CATEGORIES = [
  "Hidráulica",
  "Elétrica",
  "Revestimento",
  "Estrutural",
  "Impermeabilização",
  "Carpintaria",
  "Pintura",
  "Segurança do Trabalho",
  "Planejamento",
  "Outros",
] as const;

export type NcCategory = (typeof NC_CATEGORIES)[number];

export const ROOT_CAUSES = [
  "Falha de Execução",
  "Falha de Material",
  "Erro de Projeto",
  "Falta de Fiscalização",
  "Condição Climática",
  "Outros",
] as const;

export type NcRootCause = (typeof ROOT_CAUSES)[number];

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(value: number): string {
  return brlFormatter.format(value);
}

export function parseCurrencyInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
