/**
 * Minha Semana — inbox de trabalho pessoal do staff.
 *
 * Reúne atividades, NCs, tickets, formalizações, alertas e pendências que
 * exigem ação do usuário logado, agrupados por urgência temporal. Sem
 * mutações: cada item leva para a tela de origem.
 */
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader, EmptyState } from "@/components/ui-premium";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Inbox, RefreshCw, CheckCircle2 } from "lucide-react";
import { useMinhaSemana, type InboxItem as InboxItemType } from "@/hooks/useMinhaSemana";
import { InboxItem } from "@/components/gestao/minha-semana/InboxItem";
import { DiariosHojeCard } from "@/components/gestao/minha-semana/DiariosHojeCard";
import { cn } from "@/lib/utils";

interface SectionProps {
  title: string;
  description?: string;
  items: InboxItemType[];
  tone?: "danger" | "warning" | "info" | "muted";
  emptyMessage: string;
}

function SectionHeader({
  title,
  count,
  tone,
}: {
  title: string;
  count: number;
  tone?: SectionProps["tone"];
}) {
  const toneClass =
    tone === "danger"
      ? "bg-destructive/10 text-destructive border-destructive/25"
      : tone === "warning"
        ? "bg-warning/10 text-warning border-warning/25"
        : tone === "info"
          ? "bg-info/10 text-info border-info/25"
          : "bg-muted text-muted-foreground border-border";
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <span
        className={cn(
          "inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full border text-[11px] font-semibold tabular-nums",
          toneClass,
        )}
      >
        {count}
      </span>
    </div>
  );
}

function Section({ title, items, tone, emptyMessage }: SectionProps) {
  return (
    <section aria-labelledby={`section-${title}`}>
      <SectionHeader title={title} count={items.length} tone={tone} />
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <InboxItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1, 2, 3].map((i) => (
        <div key={i}>
          <Skeleton className="h-5 w-40 mb-3" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MinhaSemana() {
  const { buckets, total, isLoading, isError, refetchAll } = useMinhaSemana();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Meu trabalho"
        title="Minha semana"
        description="Tudo que precisa da sua atenção agora — organizado por urgência."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchAll()}
            className="h-8 gap-2"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        }
      />

      <div className="mt-4 mb-4">
        <DiariosHojeCard />
      </div>

      <div className="mt-4">
        {isLoading ? (
          <LoadingSkeleton />
        ) : isError ? (
          <EmptyState
            icon={Inbox}
            title="Não conseguimos carregar sua semana"
            description="Verifique a conexão e tente novamente."
            action={{ label: "Tentar de novo", onClick: () => refetchAll() }}
          />
        ) : total === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Tudo em dia por aqui."
            description="Nada urgente para você agora. Aproveite para adiantar o que vem por aí."
          />
        ) : (
          <div className="space-y-8">
            <Section
              title="Atrasado"
              items={buckets.atrasado}
              tone="danger"
              emptyMessage="Nada em atraso. 🎯"
            />
            <Section
              title="Hoje"
              items={buckets.hoje}
              tone="warning"
              emptyMessage="Nada com prazo para hoje."
            />
            <Section
              title="Esta semana"
              items={buckets.semana}
              tone="info"
              emptyMessage="Semana leve — sem prazos nos próximos dias úteis."
            />
            <Section
              title="Próximas"
              items={buckets.proximas}
              tone="muted"
              emptyMessage="Sem itens agendados no horizonte."
            />
          </div>
        )}
      </div>
    </PageContainer>
  );
}
