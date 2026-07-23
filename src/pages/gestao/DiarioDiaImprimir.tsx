/**
 * /gestao/diario/:projectId/:date/imprimir — RDO em layout print-friendly.
 *
 * Staff-only. Renderiza fora do AppShell (sem sidebar/topbar), dispara
 * window.print() ao terminar de carregar dados e fotos. Layout limpo para
 * imprimir / exportar como PDF via impressora virtual do navegador.
 */
import { useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";

import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import { useProjectDailyLog } from "@/hooks/useProjectDailyLog";
import { useDailyLogPhotos } from "@/hooks/useDailyLogPhotos";
import { cn } from "@/lib/utils";

function fmtLongDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-[140px]">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm text-foreground">{value || "—"}</div>
    </div>
  );
}

export default function DiarioDiaImprimir() {
  const { projectId = "", date = "" } = useParams();
  const projectsQ = useProjectsQuery();
  const project = useMemo(
    () => (projectsQ.data ?? []).find((p) => p.id === projectId),
    [projectsQ.data, projectId],
  );
  const logQ = useProjectDailyLog(projectId || null, date);
  const photos = useDailyLogPhotos(projectId || null, date);
  const printed = useRef(false);

  const ready =
    !projectsQ.isLoading && !logQ.isLoading && !photos.isLoading;

  useEffect(() => {
    if (!ready || printed.current) return;
    printed.current = true;
    // pequena espera para as imagens começarem a decodificar
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [ready]);

  const log = logQ.data;
  const workers = log?.workers ?? [];
  const services = log?.services ?? [];
  const severityLabel = log?.occurrence_severity ?? null;

  return (
    <div
      className={cn(
        "bg-background text-foreground min-h-screen p-8 print:p-0",
      )}
    >
      <style>{`
        @page { size: A4; margin: 16mm; }
        @media print {
          html, body { background: white !important; }
          .no-print { display: none !important; }
          a { color: inherit; text-decoration: none; }
        }
      `}</style>

      <header className="border-b pb-4 mb-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Relatório diário de obra
            </div>
            <h1 className="text-2xl font-semibold leading-tight">
              {project?.name ?? "Obra"}
            </h1>
            <div className="text-sm text-muted-foreground">
              {fmtLongDate(date)}
            </div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            Emitido em {new Date().toLocaleString("pt-BR")}
          </div>
        </div>
      </header>

      {/* Clima */}
      <section className="mb-5">
        <h2 className="text-sm font-semibold mb-2">Clima</h2>
        <div className="flex flex-wrap gap-6">
          <Field label="Manhã" value={log?.weather_morning ?? "—"} />
          <Field label="Tarde" value={log?.weather_afternoon ?? "—"} />
          <Field
            label="Temperatura"
            value={
              log?.temperature_c !== null && log?.temperature_c !== undefined
                ? `${log?.temperature_c} °C`
                : "—"
            }
          />
        </div>
      </section>

      {/* Efetivo */}
      <section className="mb-5">
        <h2 className="text-sm font-semibold mb-2">
          Efetivo ({workers.length})
        </h2>
        {workers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum trabalhador registrado.
          </p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1 pr-2">Nome</th>
                <th className="py-1 pr-2">Função</th>
                <th className="py-1 pr-2">Turno</th>
                <th className="py-1">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w, i) => (
                <tr key={i} className="border-b last:border-0 align-top">
                  <td className="py-1 pr-2">{w.name || "—"}</td>
                  <td className="py-1 pr-2">{w.role || "—"}</td>
                  <td className="py-1 pr-2 tabular-nums">
                    {(w.shift_start || w.shift_end)
                      ? `${w.shift_start ?? "—"} – ${w.shift_end ?? "—"}`
                      : "—"}
                  </td>
                  <td className="py-1">{w.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Serviços */}
      <section className="mb-5">
        <h2 className="text-sm font-semibold mb-2">
          Serviços executados ({services.length})
        </h2>
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum serviço registrado.
          </p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1 pr-2">Descrição</th>
                <th className="py-1 pr-2">Status</th>
                <th className="py-1">Observações</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s, i) => (
                <tr key={i} className="border-b last:border-0 align-top">
                  <td className="py-1 pr-2">{s.description || "—"}</td>
                  <td className="py-1 pr-2">{s.status ?? "—"}</td>
                  <td className="py-1 whitespace-pre-line">
                    {s.observations || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Ocorrências */}
      <section className="mb-5">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
          Ocorrências e impedimentos
          {severityLabel && (
            <span
              className={cn(
                "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium",
                severityLabel === "Alta"
                  ? "border-destructive/40 text-destructive"
                  : severityLabel === "Média"
                    ? "border-warning/40 text-warning"
                    : "border-border text-muted-foreground",
              )}
            >
              {severityLabel}
            </span>
          )}
        </h2>
        <div className="text-sm whitespace-pre-line min-h-[48px]">
          {log?.notes || "—"}
        </div>
      </section>

      {/* Fotos */}
      <section className="mb-4">
        <h2 className="text-sm font-semibold mb-2">
          Fotos do dia ({photos.photos.length})
        </h2>
        {photos.photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem fotos.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.photos.map((p) => (
              <div
                key={p.id}
                className="aspect-square overflow-hidden rounded border bg-muted break-inside-avoid"
              >
                {p.url ? (
                  <img
                    src={p.url}
                    alt={p.caption ?? "Foto do dia"}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="mt-8 pt-3 border-t text-[10px] text-muted-foreground flex items-center justify-between">
        <span>Portal BWild — Relatório interno</span>
        <span>
          {log?.updated_at
            ? `Última atualização: ${new Date(log.updated_at).toLocaleString("pt-BR")}`
            : ""}
        </span>
      </footer>

      <div className="no-print mt-6 text-center">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 h-10 rounded-md border bg-background hover:bg-muted text-sm"
        >
          Imprimir novamente
        </button>
      </div>
    </div>
  );
}
