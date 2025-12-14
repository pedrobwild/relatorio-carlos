import { ArrowLeft, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import bwildLogo from "@/assets/bwild-logo.png";

const Contrato = () => {
  return (
    <div className="min-h-screen min-h-[100dvh] pb-safe bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-primary/5 via-background to-background border-b border-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Link to="/relatorio">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <img src={bwildLogo} alt="Bwild" className="h-7 w-auto" />
            <div className="h-5 w-px bg-border/60" />
            <h1 className="font-bold text-lg text-foreground">Contrato</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card rounded-xl border border-border p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Contrato do Projeto</h2>
                <p className="text-sm text-muted-foreground">Documentação contratual</p>
              </div>
            </div>
            
            <div className="space-y-4 text-muted-foreground">
              <p>Esta página conterá os documentos contratuais do projeto, incluindo:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Contrato de prestação de serviços</li>
                <li>Termos e condições</li>
                <li>Cronograma contratual</li>
                <li>Anexos e aditivos</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contrato;
