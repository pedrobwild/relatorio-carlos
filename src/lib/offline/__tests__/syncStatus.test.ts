import { describe, it, expect } from "vitest";
import { networkBannerSuppression, syncStatusFor } from "@/lib/offline/syncStatus";

describe("linha de estado da fila offline", () => {
  it("sem sinal, com registros guardados", () => {
    expect(syncStatusFor({ online: false, pending: 3, justFlushed: false })).toEqual({
      tone: "offline",
      text: "Sem sinal — 3 registros aguardando envio",
    });
    expect(syncStatusFor({ online: false, pending: 1, justFlushed: false })?.text).toBe(
      "Sem sinal — 1 registro aguardando envio",
    );
  });

  it("sem sinal e nada guardado: avisa que dá para marcar mesmo assim", () => {
    const s = syncStatusFor({ online: false, pending: 0, justFlushed: false });
    expect(s?.tone).toBe("offline");
    expect(s?.text).toMatch(/^Sem sinal — o que você marcar fica guardado/);
  });

  it("com sinal e fila andando: Enviando…", () => {
    expect(syncStatusFor({ online: true, pending: 2, justFlushed: false })).toEqual({
      tone: "sending",
      text: "Enviando 2 registros…",
    });
  });

  it("fila esvaziou: Tudo enviado; depois some", () => {
    expect(syncStatusFor({ online: true, pending: 0, justFlushed: true })).toEqual({
      tone: "done",
      text: "Tudo enviado",
    });
    expect(syncStatusFor({ online: true, pending: 0, justFlushed: false })).toBeNull();
  });

  it("o aviso global de rede fica quieto enquanto alguma tela pede", () => {
    expect(networkBannerSuppression.isSuppressed()).toBe(false);
    const release = networkBannerSuppression.acquire();
    expect(networkBannerSuppression.isSuppressed()).toBe(true);
    release();
    release(); // idempotente
    expect(networkBannerSuppression.isSuppressed()).toBe(false);
  });
});
