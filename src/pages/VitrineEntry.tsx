import { useEffect } from "react";

/**
 * VitrineEntry — /vitrine/:projectId
 * Entrada da LP da placa de obra (bewild.com.br/o).
 * Não faz mais login demo: apenas redireciona para o site.
 */
export default function VitrineEntry() {
  useEffect(() => {
    window.location.replace("https://bewild.com.br/#workflow");
  }, []);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Abrindo…</p>
      </div>
    </div>
  );
}
