import { cn } from "@/lib/utils";

interface ReportSectionProps {
  title: string;
  variant: "purple" | "blue" | "green" | "orange" | "yellow";
  children: React.ReactNode;
  className?: string;
}

const sectionVariants = {
  purple: "border-l-primary bg-gradient-to-r from-accent to-card",
  blue: "border-l-info bg-gradient-to-r from-info-light to-card",
  green: "border-l-success bg-gradient-to-r from-success-light to-card",
  orange: "border-l-warning bg-gradient-to-r from-warning-light to-card",
  yellow: "border-l-warning bg-gradient-to-r from-warning-light to-card",
};

const ReportSection = ({ title, variant, children, className }: ReportSectionProps) => (
  <div
    className={cn(
      "p-4 md:p-6 rounded-lg mb-4 md:mb-6 border-l-4",
      sectionVariants[variant],
      className
    )}
  >
    {title && (
      <h3 className="text-base md:text-xl font-bold text-foreground mb-3 md:mb-4">{title}</h3>
    )}
    {children}
  </div>
);

const TechnicalReport = () => {
  return (
    <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
      <ReportSection variant="purple" title="">
        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          Atualização Técnica da Obra
        </h2>
      </ReportSection>

      <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-4 md:mb-6">
        <strong className="text-foreground">Olá, Carlos Ney, tudo bem?</strong>
        <br /><br />
        Quero te trazer uma atualização técnica e objetiva sobre o andamento da obra. 
        De fato, tivemos um atraso concentrado no início (mobilização e encadeamento de frentes), 
        mas a obra está estabilizada, com planejamento reprogramado, equipes sincronizadas e 
        suprimentos antecipados. <strong className="text-foreground">Mantemos a data de entrega em 19/01/2026</strong>, 
        com a estratégia de recuperação já em execução.
      </p>

      <ReportSection variant="blue" title="1) Previsto x Realizado (visão técnica)">
        <ul className="list-disc ml-4 md:ml-6 text-sm md:text-base text-muted-foreground leading-relaxed space-y-2">
          <li>O desvio ocorreu na fase inicial por impacto de sequência e liberação de frentes.</li>
          <li>A partir do replanejamento, passamos a operar com programação semanal travada, controle de pré-requisitos e execução por frentes compatíveis, reduzindo "tempos mortos" entre equipes.</li>
          <li>O cronograma foi reordenado sem alteração do marco final, priorizando o caminho crítico e eliminando esperas desnecessárias.</li>
        </ul>
      </ReportSection>

      <ReportSection variant="green" title="2) Estratégia adotada para recuperar prazo (sem comprometer qualidade)">
        <h4 className="text-sm md:text-lg font-semibold text-foreground mt-3 md:mt-4 mb-2 md:mb-3">
          a) Fast-tracking controlado (frentes paralelas)
        </h4>
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-3 md:mb-4">
          Organizamos a produção para executar atividades compatíveis em paralelo, com sequência 
          "mão na massa" por turnos (manhã/tarde) e por ambiente, evitando sobreposição conflitante.
        </p>
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-2">
          <strong className="text-foreground">Exemplos práticos de recuperação:</strong>
        </p>
        <ul className="list-disc ml-4 md:ml-6 text-sm md:text-base text-muted-foreground leading-relaxed space-y-2 mb-3 md:mb-4">
          <li>Rodapé pela manhã + iluminação à tarde, no mesmo dia e no mesmo ambiente (quando já liberado).</li>
          <li>Instalação do ar-condicionado e instalação do box programadas em janelas coordenadas, para não gerar interferência e nem risco de dano em acabamento.</li>
        </ul>

        <h4 className="text-sm md:text-lg font-semibold text-foreground mt-4 md:mt-6 mb-2 md:mb-3">
          b) Pintura em duas etapas (produção + pós-marcenaria)
        </h4>
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-2">
          Para evitar gargalo no final e reduzir retrabalho:
        </p>
        <ul className="list-disc ml-4 md:ml-6 text-sm md:text-base text-muted-foreground leading-relaxed space-y-2 mb-3 md:mb-4">
          <li>Executamos a pintura principal antecipadamente (produção).</li>
          <li>Mantemos uma fase de retoques finais após a marcenaria, porque a montagem naturalmente gera marcas/encostos. Assim, o acabamento de entrega fica no padrão esperado.</li>
        </ul>

        <h4 className="text-sm md:text-lg font-semibold text-foreground mt-4 md:mt-6 mb-2 md:mb-3">
          c) Gestão de restrições (pré-requisitos e liberações)
        </h4>
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-2">
          A cada frente, trabalhamos com a lógica:
        </p>
        <ul className="list-disc ml-4 md:ml-6 text-sm md:text-base text-muted-foreground leading-relaxed space-y-2">
          <li>o que precisa estar pronto antes (liberação de área / cura / limpeza / proteção)</li>
          <li>o que não pode acontecer junto (interferência de equipes e risco a acabamento)</li>
        </ul>
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed mt-3 md:mt-4">
          Isso garante produtividade e previsibilidade na reta final.
        </p>
      </ReportSection>

      <ReportSection variant="orange" title="3) Suprimentos e logística (blindagem de fim de ano)">
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
          Como estamos em período de sazonalidade e prazos mais longos, antecipamos compras e organização 
          de itens com maior lead time, como rodapé, enxoval e eletrodomésticos (e itens correlatos de 
          entrega/instalação), para que a obra não dependa de entrega "em cima da hora" e não sofra 
          impacto de mercado/transportadora.
        </p>
      </ReportSection>

      <ReportSection variant="purple" title="4) Governança e controle (como garantimos previsibilidade)">
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-3 md:mb-4">
          Para te dar segurança e rastreabilidade até a entrega, seguimos com um modelo de controle 
          mais rígido nesta reta final:
        </p>
        <ul className="list-disc ml-4 md:ml-6 text-sm md:text-base text-muted-foreground leading-relaxed space-y-2">
          <li><strong className="text-foreground">Plano semanal (lookahead):</strong> o que executa nos próximos 7 dias + pré-requisitos travados</li>
          <li><strong className="text-foreground">Check de frentes:</strong> equipe certa, material no local, área liberada e protegida antes de iniciar</li>
          <li><strong className="text-foreground">Checklist de qualidade por ambiente:</strong> testes de funcionamento (iluminação/ar), alinhamentos, vedação/silicone, acabamento final e limpeza técnica antes de considerar concluído</li>
        </ul>
      </ReportSection>

      <ReportSection variant="yellow" title="5) Próximos marcos (o que destrava a reta final)">
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-3 md:mb-4">
          Assim que a marcenaria concluir a montagem, entramos imediatamente com:
        </p>
        <ul className="list-disc ml-4 md:ml-6 text-sm md:text-base text-muted-foreground leading-relaxed space-y-2">
          <li>instalação de rodapé</li>
          <li>instalação de iluminação conforme projeto</li>
          <li>demais acabamentos finais (ajustes, vedações, retoques de pintura)</li>
          <li>limpeza e fechamento para entrega</li>
        </ul>
      </ReportSection>

      <div className="bg-gradient-to-r from-accent to-primary/20 p-4 md:p-6 rounded-lg mt-6 md:mt-8">
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-3 md:mb-4">
          Fico à disposição e seguimos com o compromisso de entregar no prazo e com qualidade, 
          com acompanhamento técnico até a finalização.
        </p>
        <p className="font-semibold text-foreground text-sm md:text-base">Pedro Henrique Alves Pereira</p>
        <p className="text-primary font-bold text-sm md:text-base">CEO - Bwild</p>
      </div>
    </div>
  );
};

export default TechnicalReport;
