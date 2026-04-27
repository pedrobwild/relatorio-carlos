import { Package } from "lucide-react";
import { EmptyState } from "@/components/ui/states";

export default function Estoque() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-h2 font-bold flex items-center gap-2">
          <Package className="h-6 w-6" />
          Estoque
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Controle de materiais e insumos disponíveis no estoque.
        </p>
      </header>

      <EmptyState
        icon={Package}
        title="Módulo de Estoque em construção"
        description="Em breve você poderá gerenciar entradas, saídas e saldo de materiais por obra."
      />
    </main>
  );
}
