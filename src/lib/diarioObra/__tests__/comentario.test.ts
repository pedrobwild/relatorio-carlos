import { describe, expect, it } from "vitest";
import { comentarioValido, corpoDoComentario, referenciaDoRelato, COMENTARIO_DIARIO_MAX } from "../comentario";

describe("comentário a partir do diário", () => {
  const ctx = { dia: "2026-11-24", etapa: " Pintura " };

  it("diz de qual dia e etapa do diário é", () => {
    expect(referenciaDoRelato(ctx)).toBe("Diário de 24/11 · Pintura");
    expect(corpoDoComentario(ctx, "  Falta comprar tinta.  ")).toBe("Diário de 24/11 · Pintura\nFalta comprar tinta.");
  });

  it("não aceita vazio nem maior que o limite da observação", () => {
    expect(comentarioValido("   ")).toBe(false);
    expect(comentarioValido("ok")).toBe(true);
    expect(comentarioValido("a".repeat(COMENTARIO_DIARIO_MAX + 1))).toBe(false);
    // referência + comentário cabem no limite de 4000 da observação interna
    expect(corpoDoComentario({ dia: "2026-11-24", etapa: "x".repeat(150) }, "a".repeat(COMENTARIO_DIARIO_MAX)).length).toBeLessThanOrEqual(4000);
  });
});
