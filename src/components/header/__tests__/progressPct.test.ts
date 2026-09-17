import { describe, it, expect } from "vitest";
import { getHeaderProgressPct } from "../progressPct";

describe("getHeaderProgressPct (cabeçalho mobile da obra)", () => {
  it("usa o avanço realizado, não o tempo decorrido", () => {
    // Obra atrasada: 0 atividades concluídas, prazo estourado em 2,5×.
    // Antes o cabeçalho mostrava 256%; deve mostrar 0%.
    expect(getHeaderProgressPct({ actualProgress: 0 })).toBe(0);
    expect(getHeaderProgressPct({ actualProgress: 42.4 })).toBe(42);
  });

  it("nunca ultrapassa 0–100", () => {
    expect(getHeaderProgressPct({ actualProgress: 256 })).toBe(100);
    expect(getHeaderProgressPct({ actualProgress: -5 })).toBe(0);
    expect(getHeaderProgressPct({ actualProgress: Number.NaN })).toBe(0);
  });
});
