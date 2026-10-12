/**
 * Resumo da semana (diretoria): semanas, PPC da carteira, carteira agora,
 * lista de atenção, adoção por gestor e o texto do WhatsApp.
 */
import { afterEach, describe, it, expect } from "vitest";
import type { ObraRow } from "@/lib/obrasPainel";
import { todayISO } from "@/lib/hojeDia";
import {
  adocaoLine,
  atencaoReason,
  buildResumo,
  mondayShortLabel,
  rateOf,
  resumoWeeks,
  resumoWhatsApp,
  SEM_RESPONSAVEL,
  sumReasons,
  weekShortLabel,
  type ResumoAssignment,
  type ResumoClosing,
} from "@/lib/resumoSemanal";

const TODAY = "2026-10-12"; // segunda-feira

const base: ObraRow = {
  id: "x",
  name: "Obra",
  customer: null,
  responsibleId: "ana",
  responsible: "Ana",
  deadline: "2026-12-30",
  projectedEnd: "2026-12-01",
  slack: 10,
  penalty: 0,
  progress: 50,
  consumed: 40,
  week: { stages: [], planned: 0, done: 0, notDone: 0, unplanned: false },
  alerts: [],
  risk: "verde",
  cadastro: { etapa: "Execução", relationship: null, paused: false },
};
const row = (p: Partial<ObraRow>): ObraRow => ({ ...base, ...p });
const asg = (project_id: string, work_date: string): ResumoAssignment => ({ project_id, work_date });
const closing = (project_id: string, week_start: string, planned: number, done: number, reasons: unknown = {}): ResumoClosing => ({
  project_id,
  week_start,
  planned,
  done,
  reasons,
});

describe("resumoWeeks", () => {
  it("numa segunda, a semana que passou é a anterior inteira", () => {
    const w = resumoWeeks(TODAY);
    expect(w.current).toBe("2026-10-12");
    expect(w.last).toBe("2026-10-05");
    expect(w.history).toEqual(["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"]);
    expect(w.from).toBe("2026-09-14");
    expect(w.to).toBe("2026-10-18");
  });

  it("num domingo a semana corrente ainda não terminou", () => {
    const w = resumoWeeks("2026-10-11");
    expect(w.current).toBe("2026-10-05");
    expect(w.last).toBe("2026-09-28");
  });

  it("virada de mês e de ano", () => {
    expect(resumoWeeks("2026-01-02").last).toBe("2025-12-22");
    expect(weekShortLabel("2026-09-28")).toBe("28/set–4/out");
    expect(weekShortLabel("2026-10-05")).toBe("5–11/out");
    expect(mondayShortLabel("2026-10-05")).toBe("5/out");
  });

  describe("fuso horário", () => {
    const original = process.env.TZ;
    afterEach(() => {
      process.env.TZ = original;
    });

    it.each(["America/Sao_Paulo", "UTC"])("mesmas semanas a partir da data em %s", (tz) => {
      process.env.TZ = tz;
      expect(resumoWeeks(TODAY).last).toBe("2026-10-05");
      expect(resumoWeeks("2026-10-18").last).toBe("2026-10-05");
      expect(resumoWeeks("2026-10-19").last).toBe("2026-10-12");
    });

    it("domingo 23h em São Paulo ainda é domingo: a semana não terminou", () => {
      process.env.TZ = "America/Sao_Paulo";
      // 2026-10-12T02:00Z = domingo 11/10, 23h em São Paulo.
      const today = todayISO(new Date("2026-10-12T02:00:00Z"));
      expect(today).toBe("2026-10-11");
      expect(resumoWeeks(today).last).toBe("2026-09-28");
    });
  });
});

describe("buildResumo · semana que passou", () => {
  it("PPC da carteira soma dias feitos ÷ dias marcados dos fechamentos", () => {
    const rows = [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })];
    const r = buildResumo({
      rows,
      today: TODAY,
      assignments: [asg("a", "2026-10-06"), asg("b", "2026-10-07"), asg("b", "2026-10-11")],
      closings: [closing("a", "2026-10-05", 3, 2), closing("b", "2026-10-05", 4, 3)],
    });
    expect(r.semana.ppc).toBe(71); // 5/7 = 71,4%
    expect(r.semana.done).toBe(5);
    expect(r.semana.planned).toBe(7);
    expect(r.semana.closed).toBe(2);
    expect(r.semana.withPlan).toBe(2);
    expect(r.semana.withoutPlan).toBe(1);
    expect(r.semana.label).toBe("5–11/out");
  });

  it("PPC arredonda (2/3 = 67%) e sem fechamento fica null", () => {
    const rows = [row({ id: "a" })];
    expect(buildResumo({ rows, today: TODAY, assignments: [], closings: [closing("a", "2026-10-05", 3, 2)] }).semana.ppc).toBe(67);
    expect(buildResumo({ rows, today: TODAY, assignments: [], closings: [] }).semana.ppc).toBeNull();
  });

  it("fechamentos e dias de obras fora de execução são ignorados", () => {
    const r = buildResumo({
      rows: [row({ id: "a" })],
      today: TODAY,
      assignments: [asg("entregue", "2026-10-06"), asg(null as unknown as string, "2026-10-06")],
      closings: [closing("entregue", "2026-10-05", 10, 0, { clima: 5 }), closing("a", "2026-10-05", 2, 2)],
    });
    expect(r.semana.ppc).toBe(100);
    expect(r.semana.closed).toBe(1);
    expect(r.semana.withPlan).toBe(0);
    expect(r.semana.reasons).toEqual([]);
  });

  it("dia de domingo conta na semana; segunda seguinte não", () => {
    const r = buildResumo({
      rows: [row({ id: "a" }), row({ id: "b" })],
      today: TODAY,
      assignments: [asg("a", "2026-10-11"), asg("b", "2026-10-12")],
      closings: [],
    });
    expect(r.semana.withPlan).toBe(1);
  });

  it("obra paralisada não conta como sem planejamento", () => {
    const r = buildResumo({
      rows: [row({ id: "a", cadastro: { etapa: null, relationship: null, paused: true } }), row({ id: "b" })],
      today: TODAY,
      assignments: [],
      closings: [],
    });
    expect(r.semana.withoutPlan).toBe(1);
    expect(r.carteira.paused).toBe(1);
  });

  it("motivos somados com rótulo em português, do mais frequente ao menos", () => {
    const r = buildResumo({
      rows: [row({ id: "a" }), row({ id: "b" })],
      today: TODAY,
      assignments: [],
      closings: [
        closing("a", "2026-10-05", 5, 2, { material: 2, clima: 1 }),
        closing("b", "2026-10-05", 5, 3, { material: 1, equipe: 1 }),
        // Semana anterior não entra nos motivos da semana que passou.
        closing("b", "2026-09-28", 5, 0, { cliente_decisao: 5 }),
      ],
    });
    expect(r.semana.reasons.map((x) => [x.label, x.count])).toEqual([
      ["Faltou material", 3],
      ["Clima", 1],
      ["Faltou equipe", 1],
    ]);
  });
});

describe("sumReasons", () => {
  it("ignora formato inválido, motivo desconhecido e zero", () => {
    expect(
      sumReasons([{ reasons: null }, { reasons: [1, 2] }, { reasons: { inventado: 3, clima: 0, outro: "2" } }]),
    ).toEqual([{ reason: "outro", label: "Outro", count: 2 }]);
  });
});

describe("buildResumo · carteira agora", () => {
  it("números da carteira e entregas nas próximas 2 semanas", () => {
    const rows = [
      row({ id: "a", name: "Ap 12", risk: "vermelho", slack: -3, penalty: 1500, deadline: "2026-10-20" }),
      row({ id: "b", name: "Casa B", risk: "amarelo", slack: 1, deadline: "2026-10-12" }),
      row({ id: "c", name: "Loja C", risk: "sem_prazo", slack: null, deadline: null }),
      row({ id: "d", name: "Longe", deadline: "2026-10-27" }),
      row({ id: "e", name: "Passou", risk: "vermelho", slack: -2, penalty: null, deadline: "2026-10-09" }),
    ];
    const c = buildResumo({ rows, today: TODAY, assignments: [], closings: [] }).carteira;
    expect(c.active).toBe(5);
    expect(c.red).toBe(2);
    expect(c.yellow).toBe(1);
    expect(c.noDeadline).toBe(1);
    expect(c.penaltyTotal).toBe(1500);
    expect(c.penaltyUnknown).toBe(1);
    expect(c.deliveries.map((d) => d.name)).toEqual(["Casa B", "Ap 12"]);
  });

  it("sem obras: tudo zerado", () => {
    const r = buildResumo({ rows: [], today: TODAY, assignments: [], closings: [] });
    expect(r.carteira.active).toBe(0);
    expect(r.atencao).toEqual([]);
    expect(r.adocao).toEqual([]);
    expect(r.semana.ppc).toBeNull();
    expect(r.semana.withoutPlan).toBe(0);
  });
});

describe("buildResumo · precisa de atenção", () => {
  it("vermelho primeiro, depois mais atraso e maior multa; no máximo 5; verde fica de fora", () => {
    const rows = [
      row({ id: "y1", name: "Amarela", risk: "amarelo", slack: 1 }),
      row({ id: "r1", name: "Vermelha leve", risk: "vermelho", slack: -1, penalty: 100 }),
      row({ id: "r2", name: "Vermelha grave", risk: "vermelho", slack: -8, penalty: 900 }),
      row({ id: "r3", name: "Vermelha multa", risk: "vermelho", slack: -1, penalty: 5000 }),
      row({ id: "y2", name: "Amarela 2", risk: "amarelo", slack: 2 }),
      row({ id: "y3", name: "Amarela 3", risk: "amarelo", slack: null }),
      row({ id: "g", name: "Verde", risk: "verde" }),
    ];
    const ids = buildResumo({ rows, today: TODAY, assignments: [], closings: [] }).atencao.map((a) => a.id);
    expect(ids).toEqual(["r2", "r3", "r1", "y1", "y2"]);
  });

  it("um motivo curto: primeiro alerta que não é informativo", () => {
    expect(
      atencaoReason({
        risk: "vermelho",
        alerts: [
          { kind: "sem_prazo", tone: "muted", text: "Prazo do contrato não cadastrado" },
          { kind: "etapa_atrasada", tone: "destructive", text: "Pintura atrasada 4 dias" },
        ],
      }),
    ).toBe("Pintura atrasada 4 dias");
    expect(atencaoReason({ risk: "amarelo", alerts: [] })).toBe("Atenção");
  });
});

describe("buildResumo · adoção só a partir do início da obra", () => {
  it("semana que terminou antes do início da execução não é cobrada", () => {
    const rows = [
      row({ id: "n1", responsibleId: "ana", responsible: "Ana" }),
      row({ id: "v1", responsibleId: "ana", responsible: "Ana" }),
    ];
    // n1 começou na quarta 30/09: as semanas de 14/09 e 21/09 não contam; a de 28/09 conta.
    const startedOn = new Map<string, string | null>([["n1", "2026-09-30"], ["v1", null]]);
    const closings: ResumoClosing[] = [
      closing("n1", "2026-09-28", 2, 2),
      closing("n1", "2026-10-05", 2, 2),
      closing("v1", "2026-10-05", 2, 2),
    ];
    const r = buildResumo({ rows, today: TODAY, assignments: [], closings, startedOn });
    const ana = r.adocao[0];
    expect(ana.weeks.map((w) => [w.monday, w.due, w.closed])).toEqual([
      ["2026-09-14", 1, 0],
      ["2026-09-21", 1, 0],
      ["2026-09-28", 2, 1],
      ["2026-10-05", 2, 2],
    ]);
    // 3 fechadas de 6 cobradas (e não de 8).
    expect(ana.closedRate).toBe(50);
  });
});

describe("buildResumo · adoção por gestor", () => {
  const rows = [
    row({ id: "a1", responsibleId: "ana", responsible: "Ana" }),
    row({ id: "a2", responsibleId: "ana", responsible: "Ana" }),
    row({ id: "b1", responsibleId: "bruno", responsible: "Bruno" }),
    row({ id: "s1", responsibleId: null, responsible: "Engenheiro antigo" }),
    row({ id: "b2", responsibleId: "bruno", responsible: "Bruno", cadastro: { etapa: null, relationship: null, paused: true } }),
  ];
  // Ana planeja e fecha tudo nas 4 semanas; Bruno só planejou a última e não fechou.
  const weeks = ["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"];
  const assignments: ResumoAssignment[] = [
    ...weeks.flatMap((w) => [asg("a1", w), asg("a2", w)]),
    asg("b1", "2026-10-06"),
    asg("a1", "2026-10-13"), // semana corrente
    asg("b2", "2026-10-06"), // paralisada: não conta
  ];
  const closings: ResumoClosing[] = [
    ...weeks.flatMap((w) => [closing("a1", w, 4, 3), closing("a2", w, 4, 4)]),
    closing("s1", "2026-10-05", 2, 1),
  ];
  const r = buildResumo({ rows, today: TODAY, assignments, closings });
  const gestor = (id: string | null) => {
    const g = r.adocao.find((x) => x.responsibleId === id);
    if (!g) throw new Error(`gestor ${id} não encontrado`);
    return g;
  };

  it("uma linha por responsável e uma para obras sem responsável, menor adoção primeiro", () => {
    expect(r.adocao.map((g) => g.name)).toEqual(["Bruno", SEM_RESPONSAVEL, "Ana"]);
  });

  it("contagens por semana, taxa das 4 semanas, semana corrente e PPC", () => {
    const ana = gestor("ana");
    expect(ana.n).toBe(2);
    expect(ana.weeks).toEqual(weeks.map((monday) => ({ monday, due: 2, planned: 2, closed: 2 })));
    expect(ana.closedRate).toBe(100);
    expect(ana.plannedRate).toBe(100);
    expect(ana.plannedThisWeek).toBe(1);
    expect(ana.lastPpc).toBe(88); // 7/8

    const bruno = gestor("bruno");
    expect(bruno.obras).toBe(2);
    expect(bruno.n).toBe(1);
    expect(bruno.weeks.at(-1)).toEqual({ monday: "2026-10-05", due: 1, planned: 1, closed: 0 });
    expect(bruno.closedRate).toBe(0);
    expect(bruno.plannedRate).toBe(25);
    expect(bruno.lastPpc).toBeNull();

    const sem = gestor(null);
    expect(sem.name).toBe(SEM_RESPONSAVEL);
    expect(sem.closedRate).toBe(25);
    expect(sem.lastPpc).toBe(50);
  });

  it("gestor só com obras paralisadas vai para o fim, sem taxa", () => {
    const res = buildResumo({
      rows: [
        row({ id: "p", responsibleId: "caio", responsible: "Caio", cadastro: { etapa: null, relationship: null, paused: true } }),
        row({ id: "a", responsibleId: "ana", responsible: "Ana" }),
      ],
      today: TODAY,
      assignments: [],
      closings: [],
    });
    expect(res.adocao.map((g) => [g.name, g.closedRate])).toEqual([
      ["Ana", 0],
      ["Caio", null],
    ]);
    expect(adocaoLine(res.adocao[1])).toBe("Caio: 1 obra paralisada");
  });

  it("rateOf arredonda e não divide por zero", () => {
    expect(rateOf(1, 3)).toBe(33);
    expect(rateOf(2, 3)).toBe(67);
    expect(rateOf(0, 0)).toBeNull();
  });
});

describe("resumoWhatsApp", () => {
  it("texto curto, sem tabela, com números, atenção e uma linha por gestor", () => {
    const rows = [
      row({
        id: "r",
        name: "Ap 12",
        responsibleId: "ana",
        responsible: "Ana",
        risk: "vermelho",
        slack: -3,
        penalty: 1500,
        alerts: [{ kind: "multa", tone: "destructive", text: "R$ 1.500 de multa se nada mudar" }],
      }),
      row({ id: "b", name: "Casa B", responsibleId: "bruno", responsible: "Bruno", deadline: "2026-10-20" }),
    ];
    const text = resumoWhatsApp(
      buildResumo({
        rows,
        today: TODAY,
        assignments: [asg("r", "2026-10-06"), asg("b", "2026-10-07")],
        closings: [closing("r", "2026-10-05", 4, 3, { material: 1 })],
      }),
    );
    const lines = text.split("\n");
    expect(lines[0]).toBe("*Resumo da semana 5–11/out*");
    expect(text).toContain("PPC 75% (3 de 4 dias) · 1/2 obras planejadas fecharam");
    expect(text).toContain("2 obras em execução · 1 no vermelho · 0 em atenção");
    expect(text).toContain("1 entrega em 2 semanas (Casa B)");
    expect(text).toContain("Não feito: faltou material (1)");
    expect(text).toContain("• Ap 12: R$ 1.500 de multa se nada mudar");
    expect(text).toContain("• Bruno (1 obra): fechou 0% das semanas (0/4)");
    expect(text).not.toContain("|");
    expect(lines.length).toBeLessThanOrEqual(12);
  });

  it("lista de atenção limitada a 3 no texto", () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      row({ id: `r${i}`, name: `Obra ${i}`, risk: "vermelho", slack: -i - 1, alerts: [] }),
    );
    const text = resumoWhatsApp(buildResumo({ rows, today: TODAY, assignments: [], closings: [] }));
    expect(text).toContain("*Atenção* (+2 no Painel)");
    expect(text.match(/^• Obra/gm)).toHaveLength(3);
    expect(text).toContain("PPC: nenhuma obra fechou a semana");
  });
});
