import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Info, ChevronDown } from "lucide-react";
import { ExpandableText } from "@/components/journey/ExpandableText";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function StageIntroCard() {
  const [open, setOpen] = useState(true);

  return (
    <Card className="rounded-xl shadow-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-3 pt-6 px-6 pb-3 text-left">
            <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Info className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground flex-1">
              Instruções
            </h3>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pl-[4.25rem] space-y-4">
            <ExpandableText lines={5}>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  O primeiro passo da sua jornada será uma reunião por vídeo
                  chamada com a Lorena, sócia e diretora de arquitetura da
                  Bwild.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Na reunião de briefing, nosso objetivo é te conhecer melhor:
                  estilo, objetivos, referências e prioridades. Queremos
                  traduzir tudo o que você sonhou para a primeira versão do
                  Projeto 3D, reduzindo surpresas e aumentando as chances de
                  acertarmos desde o início.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  O projeto será desenvolvido apenas dentro do que está
                  contemplado na Planilha Orçamentária (Anexo II). Customizações
                  são permitidas somente enquanto não ultrapassarem o valor
                  total do orçamento contratado. Mudanças que aumentem o valor
                  exigem aditivo contratual (novo preço e, se necessário, novo
                  prazo).
                </p>
              </div>
            </ExpandableText>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">
                Prazos importantes
              </h4>
              <ExpandableText lines={4}>
                <ul className="space-y-2">
                  <li className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
                    <span className="shrink-0">⏳</span>
                    <span>
                      Após a apresentação de cada versão do projeto, você terá{" "}
                      <strong className="text-foreground">
                        5 dias corridos
                      </strong>{" "}
                      para aprovar ou enviar observações; o silêncio ao final
                      desse prazo será considerado aprovação tácita.
                    </span>
                  </li>
                  <li className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
                    <span className="shrink-0">🔄</span>
                    <span>
                      <strong className="text-foreground">
                        Revisões previstas:
                      </strong>{" "}
                      o contrato prevê até 3 revisões do Projeto, demais
                      revisões terão custo adicional.
                    </span>
                  </li>
                  <li className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
                    <span className="shrink-0">💳</span>
                    <span>
                      <strong className="text-foreground">
                        Pagamentos em dia:
                      </strong>{" "}
                      atrasos podem paralisar o cronograma; a retomada ocorre
                      após regularização e os dias parados são adicionados ao
                      prazo final.
                    </span>
                  </li>
                </ul>
              </ExpandableText>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
