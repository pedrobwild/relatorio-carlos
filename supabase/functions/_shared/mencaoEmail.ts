/**
 * Texto dos e-mails de marcação entre a equipe. Sem dependências, para ser
 * testável. Tudo que vem do usuário é escapado.
 */
export type MencaoEmailKind = "marcado" | "resolvido" | "lembrete";

export interface MencaoEmailDados {
  kind: MencaoEmailKind;
  destinatarioNome: string;
  obra: string;
  /** Quem pediu (marcou). */
  pediu: string;
  /** Quem foi marcado. */
  marcado: string;
  /** Texto da observação interna. */
  texto: string;
  /** Resposta de quem resolveu (só em 'resolvido'). */
  resposta?: string | null;
  /** Dias corridos em aberto (só em 'lembrete'). */
  diasAberta?: number;
  link: string;
}

export function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] || "Olá";
const cortar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
/** Assunto não pode ter quebra de linha. */
const umaLinha = (s: string) => s.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();

export function assuntoDoEmail(d: MencaoEmailDados): string {
  const obra = cortar(umaLinha(d.obra), 60);
  if (d.kind === "marcado") return umaLinha(`${d.pediu} marcou você em ${obra}`);
  if (d.kind === "resolvido") return umaLinha(`${d.marcado} resolveu a pendência em ${obra}`);
  return umaLinha(`Pendência em aberto em ${obra}`);
}

export function htmlDoEmail(d: MencaoEmailDados): string {
  const chamada =
    d.kind === "marcado"
      ? `<strong>${escaparHtml(d.pediu)}</strong> marcou você em uma observação interna.`
      : d.kind === "resolvido"
        ? `<strong>${escaparHtml(d.marcado)}</strong> resolveu a pendência que você pediu.`
        : `A pendência que <strong>${escaparHtml(d.pediu)}</strong> pediu para <strong>${escaparHtml(d.marcado)}</strong> está aberta há ${d.diasAberta ?? 1} ${(d.diasAberta ?? 1) === 1 ? "dia" : "dias"}.`;
  const resposta =
    d.kind === "resolvido" && d.resposta
      ? `<p style="margin:16px 0 4px;font-size:13px;color:#64748b">Resposta</p>
         <div style="padding:12px 14px;background:#f1f5f9;border-radius:8px;font-size:15px;color:#0f172a;white-space:pre-wrap">${escaparHtml(cortar(d.resposta, 1000))}</div>`
      : "";
  const botao = d.kind === "resolvido" ? "Ver no Workflow" : "Abrir pendência";
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
  <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
    <p style="margin:0 0 4px;font-size:13px;color:#64748b">Bwild Workflow · ${escaparHtml(d.obra)}</p>
    <p style="margin:0 0 16px;font-size:16px;color:#0f172a">${escaparHtml(primeiroNome(d.destinatarioNome))}, ${chamada}</p>
    <p style="margin:0 0 4px;font-size:13px;color:#64748b">Observação</p>
    <div style="padding:12px 14px;background:#f1f5f9;border-radius:8px;font-size:15px;color:#0f172a;white-space:pre-wrap">${escaparHtml(cortar(d.texto, 1500))}</div>
    ${resposta}
    <p style="margin:24px 0 0"><a href="${escaparHtml(d.link)}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:12px 20px;border-radius:8px">${botao}</a></p>
  </div>
  <p style="margin:12px 4px 0;font-size:12px;color:#94a3b8">Aviso interno da equipe Bwild. Não encaminhe para clientes.</p>
</div></body></html>`;
}

export function textoDoEmail(d: MencaoEmailDados): string {
  const linhas = [
    d.kind === "marcado"
      ? `${d.pediu} marcou você em uma observação interna.`
      : d.kind === "resolvido"
        ? `${d.marcado} resolveu a pendência que você pediu.`
        : `A pendência que ${d.pediu} pediu para ${d.marcado} está aberta há ${d.diasAberta ?? 1} dia(s).`,
    `Obra: ${d.obra}`,
    "",
    cortar(d.texto, 1500),
  ];
  if (d.kind === "resolvido" && d.resposta) linhas.push("", `Resposta: ${cortar(d.resposta, 1000)}`);
  linhas.push("", d.link, "", "Aviso interno da equipe Bwild.");
  return linhas.join("\n");
}
