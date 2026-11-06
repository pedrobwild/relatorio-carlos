import { describe, it, expect } from "vitest";
import {
  firstName,
  needsNewRevision,
  normalizeWhatsAppPhone,
} from "../cronogramaExport";
import { CRONOGRAMA_PDF_COPY } from "@/content/cronogramaPdf";

describe("normalizeWhatsAppPhone", () => {
  it("adiciona 55 a números com DDD", () => {
    expect(normalizeWhatsAppPhone("(11) 98765-4321")).toBe("5511987654321");
  });
  it("mantém número que já tem DDI", () => {
    expect(normalizeWhatsAppPhone("+55 11 98765-4321")).toBe("5511987654321");
  });
  it("recusa telefone curto ou vazio", () => {
    expect(normalizeWhatsAppPhone("98765")).toBeNull();
    expect(normalizeWhatsAppPhone(null)).toBeNull();
  });
});

describe("needsNewRevision", () => {
  it("sem exportação anterior não pede revisão", () => {
    expect(needsNewRevision([{ updated_at: "2026-11-10T00:00:00Z" }], null)).toBe(false);
  });
  it("pede revisão quando alguma atividade mudou depois da exportação", () => {
    expect(
      needsNewRevision([{ updated_at: "2026-11-10T00:00:00Z" }], "2026-11-09T00:00:00Z"),
    ).toBe(true);
    expect(
      needsNewRevision([{ updated_at: "2026-11-08T00:00:00Z" }], "2026-11-09T00:00:00Z"),
    ).toBe(false);
  });
});

describe("mensagem do WhatsApp", () => {
  it("segue o texto combinado", () => {
    const msg = CRONOGRAMA_PDF_COPY.whatsappMessage({
      firstName: firstName("Renato Grau"),
      empreendimento: "Exalt Ibirapuera",
      unidade: "808",
      inicio: "16/11/2026",
      entrega: "12/02/2027",
      url: "https://x/y.pdf",
    });
    expect(msg).toBe(
      "Olá, Renato! Segue o cronograma da sua obra no Exalt Ibirapuera, unidade 808. Início 16/11/2026, entrega prevista 12/02/2027. Você acompanha tudo pelo Bwild Workflow. Link do PDF: https://x/y.pdf",
    );
    expect(msg).not.toMatch(/[\u2014\u2013]/);
  });
});
