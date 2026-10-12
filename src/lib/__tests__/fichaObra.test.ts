import { describe, expect, it } from "vitest";
import {
  allowedDays,
  contactEmailError,
  contactPhoneError,
  fichaFormFromInfo,
  fichaMissing,
  fichaMissingLabel,
  fichaPatch,
  formatDateBR,
  formatHour,
  keysStatus,
  mapHref,
  normalizeBrPhone,
  telHref,
  whatsappHref,
  workDaysLabel,
  workScheduleLabel,
  workWindowError,
  workWindowToday,
  type FichaInfo,
} from "../fichaObra";

const NOW = new Date(2026, 9, 14, 10, 0); // quarta, 14/10/2026 (horário local)

const completa: FichaInfo = {
  endereco_completo: "Rua Augusta, 1200",
  bairro: "Consolação",
  cidade: "São Paulo",
  cep: "01304-001",
  data_recebimento_chaves: "2026-08-03",
  keys_received_by: "Thiago",
  key_location: "Portaria",
  allowed_work_days: ["mon", "tue", "wed", "thu", "fri"],
  allowed_work_start_time: "09:00",
  allowed_work_end_time: "17:00",
  access_release_process: "Enviar lista de nomes para a administradora com 2 dias de antecedência.",
  concierge_phone: "(11) 3333-4444",
};

describe("fichaMissing", () => {
  it("ficha completa não falta nada", () => {
    expect(fichaMissing(completa)).toEqual([]);
  });

  it("obra sem ficha: lista o essencial na ordem da tela", () => {
    const tudo = [
      "Endereço",
      "Chaves",
      "Dias e horários permitidos",
      "Como pedir a liberação da equipe",
      "Telefone de um contato do prédio",
    ];
    expect(fichaMissing(null)).toEqual(tudo);
    expect(fichaMissing(undefined)).toEqual(tudo);
    expect(fichaMissing({})).toEqual(tudo);
  });

  it("chaves: basta a data OU o local", () => {
    expect(fichaMissing({ ...completa, data_recebimento_chaves: null })).toEqual([]);
    expect(fichaMissing({ ...completa, key_location: null })).toEqual([]);
    expect(fichaMissing({ ...completa, data_recebimento_chaves: null, key_location: "  " })).toEqual(["Chaves"]);
  });

  it("dias e horários: precisa dos dias e dos dois horários", () => {
    expect(fichaMissing({ ...completa, allowed_work_days: [] })).toEqual(["Dias e horários permitidos"]);
    expect(fichaMissing({ ...completa, allowed_work_end_time: null })).toEqual(["Dias e horários permitidos"]);
  });

  it("contato: qualquer telefone do prédio serve", () => {
    const semPortaria = { ...completa, concierge_phone: null };
    expect(fichaMissing(semPortaria)).toEqual(["Telefone de um contato do prédio"]);
    expect(fichaMissing({ ...semPortaria, syndic_phone: "11 99999-0000" })).toEqual([]);
    expect(fichaMissing({ ...semPortaria, building_manager_phone: "11 99999-0000" })).toEqual([]);
    expect(fichaMissing({ ...semPortaria, property_admin_phone: "11 3000-0000" })).toEqual([]);
    // Só o nome ou o e-mail não resolve na porta do prédio.
    expect(fichaMissing({ ...semPortaria, syndic_name: "Dona Marta", syndic_email: "m@x.com" })).toEqual([
      "Telefone de um contato do prédio",
    ]);
  });

  it("campos só com espaços contam como vazios", () => {
    expect(fichaMissing({ ...completa, endereco_completo: "   ", access_release_process: "\n " })).toEqual([
      "Endereço",
      "Como pedir a liberação da equipe",
    ]);
  });

  it("frase do aviso concorda com a quantidade", () => {
    expect(fichaMissingLabel(1)).toBe("Falta 1 informação nesta ficha");
    expect(fichaMissingLabel(3)).toBe("Faltam 3 informações nesta ficha");
  });
});

describe("workWindowToday", () => {
  it("dia permitido hoje: mostra o horário", () => {
    expect(workWindowToday(completa, "2026-10-14", NOW)).toEqual({ kind: "permitido", text: "Hoje: 9h às 17h" });
  });

  it("minutos quebrados e formato com segundos", () => {
    const info = { ...completa, allowed_work_start_time: "08:30:00", allowed_work_end_time: "17:05" };
    expect(workWindowToday(info, "2026-10-14", NOW)?.text).toBe("Hoje: 8h30 às 17h05");
  });

  it("dia proibido hoje", () => {
    const sabado = new Date(2026, 9, 17, 10, 0);
    expect(workWindowToday(completa, "2026-10-17", sabado)).toEqual({
      kind: "proibido",
      text: "Condomínio não permite obra hoje",
    });
  });

  it("outro dia que não hoje usa o dia da semana", () => {
    expect(workWindowToday(completa, "2026-10-15", NOW)).toEqual({ kind: "permitido", text: "Quinta: 9h às 17h" });
    expect(workWindowToday(completa, "2026-10-17", NOW)).toEqual({
      kind: "proibido",
      text: "Condomínio não permite obra no sábado",
    });
    expect(workWindowToday(completa, "2026-10-18", NOW)?.text).toBe("Condomínio não permite obra no domingo");
    const semSegunda = { ...completa, allowed_work_days: ["tue", "wed", "thu", "fri"] };
    expect(workWindowToday(semSegunda, "2026-10-19", NOW)?.text).toBe("Condomínio não permite obra na segunda");
  });

  it("o dia da semana vem da data local, não de UTC", () => {
    // 2026-10-17 é sábado em qualquer fuso; com `new Date("2026-10-17")` em
    // São Paulo (UTC-3) cairia na sexta, 21h.
    const soSabado = { ...completa, allowed_work_days: ["sat"] };
    expect(workWindowToday(soSabado, "2026-10-17", NOW)?.kind).toBe("permitido");
    expect(workWindowToday(soSabado, "2026-10-16", NOW)?.kind).toBe("proibido");
    // Virada de mês e de ano.
    expect(workWindowToday(soSabado, "2026-10-31", NOW)?.kind).toBe("permitido");
    expect(workWindowToday({ ...completa, allowed_work_days: ["fri"] }, "2027-01-01", NOW)?.kind).toBe("permitido");
  });

  it("sem dias ou sem horários informados: não afirma nada", () => {
    expect(workWindowToday(null, "2026-10-14", NOW)).toBeNull();
    expect(workWindowToday({}, "2026-10-14", NOW)).toBeNull();
    expect(workWindowToday({ ...completa, allowed_work_days: null }, "2026-10-14", NOW)).toBeNull();
    expect(workWindowToday({ ...completa, allowed_work_days: [] }, "2026-10-14", NOW)).toBeNull();
    expect(workWindowToday({ ...completa, allowed_work_start_time: null }, "2026-10-14", NOW)).toBeNull();
    expect(workWindowToday({ ...completa, allowed_work_end_time: "" }, "2026-10-14", NOW)).toBeNull();
    expect(workWindowToday({ ...completa, allowed_work_end_time: "tarde" }, "2026-10-14", NOW)).toBeNull();
  });

  it("dia fora da lista é proibido mesmo sem horário informado", () => {
    const info = { ...completa, allowed_work_start_time: null, allowed_work_end_time: null };
    expect(workWindowToday(info, "2026-10-17", NOW)?.kind).toBe("proibido");
  });

  it("data inválida ou dias desconhecidos: null", () => {
    expect(workWindowToday(completa, "14/10/2026", NOW)).toBeNull();
    expect(workWindowToday({ ...completa, allowed_work_days: ["segunda"] }, "2026-10-14", NOW)).toBeNull();
  });
});

describe("dias e horários por extenso", () => {
  it("formatHour", () => {
    expect(formatHour("09:00")).toBe("9h");
    expect(formatHour("17:30")).toBe("17h30");
    expect(formatHour("00:05")).toBe("0h05");
    expect(formatHour("25:00")).toBeNull();
    expect(formatHour("")).toBeNull();
    expect(formatHour(null)).toBeNull();
  });

  it("allowedDays: ordena, tira repetidos e ignora valores estranhos", () => {
    expect(allowedDays({ allowed_work_days: ["fri", "mon", "MON", "x"] })).toEqual(["mon", "fri"]);
    expect(allowedDays(null)).toEqual([]);
  });

  it("workDaysLabel agrupa dias seguidos", () => {
    const d = (days: string[]) => workDaysLabel({ allowed_work_days: days });
    expect(d(["mon", "tue", "wed", "thu", "fri"])).toBe("Seg a sex");
    expect(d(["mon", "tue", "wed", "thu", "fri", "sat"])).toBe("Seg a sáb");
    expect(d(["mon", "wed", "fri"])).toBe("Seg, qua e sex");
    expect(d(["mon", "tue"])).toBe("Seg e ter");
    expect(d(["mon", "tue", "wed", "sat"])).toBe("Seg a qua e sáb");
    expect(d(["sat"])).toBe("Sáb");
    expect(d(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])).toBe("Todos os dias");
    expect(d([])).toBeNull();
  });

  it("workScheduleLabel junta o que houver", () => {
    expect(workScheduleLabel(completa)).toBe("Seg a sex, 9h às 17h");
    expect(workScheduleLabel({ allowed_work_days: ["mon"] })).toBe("Seg");
    expect(workScheduleLabel({ allowed_work_start_time: "08:00", allowed_work_end_time: "12:00" })).toBe("8h às 12h");
    expect(workScheduleLabel({})).toBeNull();
  });
});

describe("chaves", () => {
  it("formatDateBR não troca o dia", () => {
    expect(formatDateBR("2026-08-03")).toBe("03/08/2026");
    expect(formatDateBR("2026-01-01")).toBe("01/01/2026");
    expect(formatDateBR(null)).toBeNull();
    expect(formatDateBR("ontem")).toBeNull();
  });

  it("keysStatus", () => {
    const hoje = "2026-10-14";
    expect(keysStatus(completa, hoje)).toEqual({ received: true, text: "Recebidas em 03/08/2026 por Thiago" });
    expect(keysStatus({ data_recebimento_chaves: "2026-08-03" }, hoje).text).toBe("Recebidas em 03/08/2026");
    expect(keysStatus({ keys_received_by: " Thiago " }, hoje).text).toBe("Recebidas por Thiago");
    expect(keysStatus({}, hoje)).toEqual({ received: false, text: "Ainda não recebidas" });
    expect(keysStatus(null, hoje).text).toBe("Ainda não recebidas");
    // Data futura sem ninguém ter recebido: é combinado, não aconteceu.
    expect(keysStatus({ data_recebimento_chaves: "2026-11-20" }, hoje)).toEqual({
      received: false,
      text: "Recebimento previsto para 20/11/2026",
    });
    expect(keysStatus({ data_recebimento_chaves: hoje }, hoje).received).toBe(true);
  });
});

describe("telefones", () => {
  it("normaliza para 55 + DDD + número", () => {
    expect(normalizeBrPhone("(11) 99999-8888")).toBe("5511999998888");
    expect(normalizeBrPhone("11 3333-4444")).toBe("551133334444");
    expect(normalizeBrPhone("+55 11 99999-8888")).toBe("5511999998888");
    expect(normalizeBrPhone("5511999998888")).toBe("5511999998888");
    expect(normalizeBrPhone("011 99999-8888")).toBe("5511999998888");
    // DDD 55 (RS) não é confundido com o código do país.
    expect(normalizeBrPhone("(55) 99999-8888")).toBe("5555999998888");
    expect(normalizeBrPhone("(55) 3222-1234")).toBe("555532221234");
  });

  it("número que não dá para discar: null", () => {
    expect(normalizeBrPhone("99999-8888")).toBeNull(); // sem DDD
    expect(normalizeBrPhone("ramal 12")).toBeNull();
    expect(normalizeBrPhone("")).toBeNull();
    expect(normalizeBrPhone(null)).toBeNull();
    expect(normalizeBrPhone("11 99999-8888 / 11 3333-4444")).toBeNull(); // dois números no mesmo campo
    expect(normalizeBrPhone("(10) 99999-8888")).toBeNull(); // DDD com zero não existe
  });

  it("links de ligar e de WhatsApp", () => {
    expect(telHref("(11) 99999-8888")).toBe("tel:+5511999998888");
    expect(whatsappHref("(11) 99999-8888")).toBe("https://wa.me/5511999998888");
    expect(telHref("sem telefone")).toBeNull();
    expect(whatsappHref("sem telefone")).toBeNull();
  });

  it("0800: dá para ligar, não tem WhatsApp", () => {
    expect(telHref("0800 123 4567")).toBe("tel:08001234567");
    expect(whatsappHref("0800 123 4567")).toBeNull();
  });
});

describe("mapa", () => {
  it("monta a busca com endereço, bairro, cidade e CEP", () => {
    expect(mapHref(completa)).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Rua Augusta, 1200, Consolação, São Paulo, 01304-001")}`,
    );
  });

  it("sem endereço não há link", () => {
    expect(mapHref({ bairro: "Moema", cidade: "São Paulo" })).toBeNull();
    expect(mapHref(null)).toBeNull();
  });
});

describe("validação do formulário", () => {
  it("telefone: opcional, mas com DDD quando preenchido", () => {
    expect(contactPhoneError("")).toBeNull();
    expect(contactPhoneError(null)).toBeNull();
    expect(contactPhoneError("(11) 99999-8888")).toBeNull();
    expect(contactPhoneError("11 3333-4444")).toBeNull();
    expect(contactPhoneError("99999-8888")).toMatch(/DDD/);
    expect(contactPhoneError("+55 11 99999-8888")).toMatch(/DDD/);
  });

  it("e-mail", () => {
    expect(contactEmailError("")).toBeNull();
    expect(contactEmailError("sindico@predio.com.br")).toBeNull();
    expect(contactEmailError("sindico@predio")).toMatch(/inválido/);
  });

  it("dias e horários andam juntos", () => {
    expect(workWindowError([], "", "")).toBeNull();
    expect(workWindowError(null, null, null)).toBeNull();
    expect(workWindowError(["mon"], "09:00", "17:00")).toBeNull();
    expect(workWindowError([], "09:00", "17:00")).toBe("Selecione pelo menos um dia da semana");
    expect(workWindowError(["mon"], "09:00", "")).toBe("Informe horário de início e término");
    expect(workWindowError(["mon"], "17:00", "09:00")).toBe("O horário de término deve ser maior que o de início");
  });
});

describe("formulário → patch", () => {
  it("sem mudança não grava nada", () => {
    expect(fichaPatch(completa, fichaFormFromInfo(completa))).toEqual({});
    expect(fichaPatch(null, fichaFormFromInfo(null))).toEqual({});
  });

  it("manda só o que mudou; vazio vira null; tira espaços das pontas", () => {
    const form = fichaFormFromInfo(completa);
    form.keys_received_by = "  Pedro ";
    form.key_location = "";
    form.concierge_name = "Seu Jorge";
    expect(fichaPatch(completa, form)).toEqual({
      keys_received_by: "Pedro",
      key_location: null,
      concierge_name: "Seu Jorge",
    });
  });

  it("dias: grava na ordem da semana e null quando esvazia", () => {
    const form = fichaFormFromInfo(completa);
    form.allowed_work_days = ["sat", "mon"];
    expect(fichaPatch(completa, form)).toEqual({ allowed_work_days: ["mon", "sat"] });
    form.allowed_work_days = [];
    expect(fichaPatch(completa, form)).toEqual({ allowed_work_days: null });
    // Mesma lista em outra ordem não é mudança.
    form.allowed_work_days = ["fri", "thu", "wed", "tue", "mon"];
    expect(fichaPatch(completa, form)).toEqual({});
  });

  it("instruções de acesso: preserva a formatação e limpa HTML perigoso", () => {
    const info = { ...completa, provider_access_instructions: "<p><strong>Interfone 12</strong></p>" };
    const form = fichaFormFromInfo(info);
    expect(form.provider_access_instructions).toBe("<p><strong>Interfone 12</strong></p>");
    expect(fichaPatch(info, form)).toEqual({});
    form.provider_access_instructions = '<p>Interfone 14<script>alert(1)</script></p>';
    expect(fichaPatch(info, form)).toEqual({ provider_access_instructions: "<p>Interfone 14</p>" });
    form.provider_access_instructions = "<p><br></p>";
    expect(fichaPatch(info, form)).toEqual({ provider_access_instructions: null });
  });
});
