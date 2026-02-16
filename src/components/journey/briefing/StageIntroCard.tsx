import { Card, CardContent } from '@/components/ui/card';
import { Info } from 'lucide-react';

export function StageIntroCard() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
            <Info className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Instruções</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Na reunião de briefing, nosso time de arquitetura buscará te conhecer: estilo, objetivos, referências e prioridades. Queremos traduzir tudo o que você sonhou para a primeira versão do Projeto 3D, reduzindo surpresas e aumentando as chances de acertarmos desde o início.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              O projeto será desenvolvido apenas dentro do que está contemplado na Planilha Orçamentária (Anexo II). Customizações são permitidas somente enquanto não ultrapassarem o valor total do orçamento contratado. Mudanças que aumentem o valor exigem aditivo contratual (novo preço e, se necessário, novo prazo).
            </p>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Prazos importantes</h4>
              <ul className="space-y-2">
                <li className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
                  <span className="shrink-0">⏳</span>
                  <span>Após a apresentação de cada versão do projeto, você terá <strong className="text-foreground">5 dias corridos</strong> para aprovar ou enviar observações; o silêncio ao final desse prazo será considerado aprovação tácita.</span>
                </li>
                <li className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
                  <span className="shrink-0">🔄</span>
                  <span><strong className="text-foreground">Revisões previstas:</strong> o contrato prevê até 3 revisões do Projeto, demais revisões terão custo adicional.</span>
                </li>
                <li className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
                  <span className="shrink-0">💳</span>
                  <span><strong className="text-foreground">Pagamentos em dia:</strong> atrasos podem paralisar o cronograma; a retomada ocorre após regularização e os dias parados são adicionados ao prazo final.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
