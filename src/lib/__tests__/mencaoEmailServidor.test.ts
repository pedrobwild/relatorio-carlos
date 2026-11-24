/**
 * Regras do e-mail de marcação que rodam no servidor (funções de borda).
 * Ficam em `supabase/functions/_shared`, sem dependências, e são testadas
 * aqui para garantir que batem com as regras da tela (`lib/mencoes`).
 */
import { describe, expect, it } from "vitest";
import {
  diaEmSaoPaulo,
  ehDiaUtil,
  horaDeLembrete,
  horasUteisEntre,
  pendenciaAtrasada,
} from "../../../supabase/functions/_shared/diasUteis";
import {
  assuntoDoEmail,
  escaparHtml,
  htmlDoEmail,
  textoDoEmail,
  type MencaoEmailDados,
} from "../../../supabase/functions/_shared/mencaoEmail";

// Horários em UTC; São Paulo = UTC-3.
const sp = (iso: string) => new Date(`${iso}-03:00`);

describe("dias úteis em São Paulo (servidor)", () => {
  it("reconhece fim de semana e feriados (fixos e móveis)", () => {
    expect(ehDiaUtil(sp("2026-11-24T10:00:00"))).toBe(true); // terça
    expect(ehDiaUtil(sp("2026-11-21T10:00:00"))).toBe(false); // sábado
    expect(ehDiaUtil(sp("2026-11-20T10:00:00"))).toBe(false); // Consciência Negra
    expect(ehDiaUtil(sp("2026-04-03T10:00:00"))).toBe(false); // Sexta-feira Santa 2026
    expect(ehDiaUtil(sp("2026-02-17T10:00:00"))).toBe(false); // terça de Carnaval 2026
    expect(ehDiaUtil(sp("2026-06-04T10:00:00"))).toBe(false); // Corpus Christi 2026
  });

  it("usa o dia de São Paulo, não o UTC", () => {
    // 22h de sexta em SP já é sábado em UTC.
    expect(diaEmSaoPaulo(sp("2026-11-27T22:00:00"))).toBe("2026-11-27");
    expect(ehDiaUtil(sp("2026-11-27T22:00:00"))).toBe(true);
  });

  it("conta só as horas de dias úteis", () => {
    expect(horasUteisEntre(sp("2026-11-24T10:00:00"), sp("2026-11-25T10:00:00"))).toBe(24);
    // sexta 16h -> segunda 10h: 8h de sexta + 10h de segunda
    expect(horasUteisEntre(sp("2026-11-27T16:00:00"), sp("2026-11-30T10:00:00"))).toBe(18);
    expect(horasUteisEntre(sp("2026-11-25T10:00:00"), sp("2026-11-24T10:00:00"))).toBe(0);
  });

  it("atrasa depois de 24 horas úteis, pulando fim de semana", () => {
    const criada = sp("2026-11-27T16:00:00").toISOString(); // sexta 16h
    expect(pendenciaAtrasada(criada, sp("2026-11-30T15:59:00"))).toBe(false);
    expect(pendenciaAtrasada(criada, sp("2026-11-30T16:01:00"))).toBe(true);
  });

  it("lembrete só em dia útil, das 9h às 18h", () => {
    expect(horaDeLembrete(sp("2026-11-24T09:10:00"))).toBe(true);
    expect(horaDeLembrete(sp("2026-11-24T08:10:00"))).toBe(false);
    expect(horaDeLembrete(sp("2026-11-24T18:10:00"))).toBe(false);
    expect(horaDeLembrete(sp("2026-11-22T10:10:00"))).toBe(false); // domingo
  });
});

describe("texto do e-mail de marcação", () => {
  const base: MencaoEmailDados = {
    kind: "marcado",
    destinatarioNome: "Thiago Dantas",
    obra: "Itaim 112",
    pediu: "Bruna Sampaio",
    marcado: "Thiago Dantas",
    texto: "Falta pagar o <b>marceneiro</b> & liberar a entrega.",
    link: "https://bwildworkflow.com/gestao/minha-semana",
  };

  it("assunto por tipo, sem quebra de linha", () => {
    expect(assuntoDoEmail(base)).toBe("Bruna Sampaio marcou você em Itaim 112");
    expect(assuntoDoEmail({ ...base, kind: "resolvido" })).toBe("Thiago Dantas resolveu a pendência em Itaim 112");
    expect(assuntoDoEmail({ ...base, kind: "lembrete" })).toBe("Pendência em aberto em Itaim 112");
    expect(assuntoDoEmail({ ...base, obra: "Itaim\r\nBcc: x@y.com" })).not.toMatch(/[\r\n]/);
  });

  it("escapa o que a pessoa escreveu", () => {
    expect(escaparHtml(`<a href="x">'&`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
    const html = htmlDoEmail(base);
    expect(html).toContain("&lt;b&gt;marceneiro&lt;/b&gt; &amp; liberar");
    expect(html).not.toContain("<b>marceneiro</b>");
    expect(html).toContain("Thiago, <strong>Bruna Sampaio</strong> marcou você");
    expect(html).toContain("Abrir pendência");
  });

  it("resolvido mostra a resposta; lembrete mostra há quantos dias", () => {
    const resolvido = htmlDoEmail({ ...base, kind: "resolvido", destinatarioNome: "Bruna Sampaio", resposta: "Pago hoje." });
    expect(resolvido).toContain("Pago hoje.");
    expect(resolvido).toContain("Ver no Workflow");
    expect(htmlDoEmail({ ...base, kind: "lembrete", diasAberta: 3 })).toContain("está aberta há 3 dias");
    expect(htmlDoEmail({ ...base, kind: "lembrete", diasAberta: 1 })).toContain("há 1 dia.");
  });

  it("tem versão em texto puro com o link", () => {
    const t = textoDoEmail(base);
    expect(t).toContain("Obra: Itaim 112");
    expect(t).toContain(base.link);
  });
});
