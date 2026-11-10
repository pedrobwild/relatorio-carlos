/**
 * Relatório da semana em passos (equipe, celular).
 *
 * Variante de apresentação do `WeeklyReportEditor`: recebe o MESMO estado
 * (`useEditorState`), então autosave, fila offline de fotos, alertas de
 * divergência e conflito são exatamente os do editor de sempre. Só muda a
 * ordem e o tamanho: fotos primeiro (é o que se faz na obra), texto depois.
 *
 * 1 Fotos · 2 Resumo · 3 Próxima semana · 4 Atenção · 5 Enviar
 */
import { useId, useState } from "react";
import { Camera, Check, ChevronLeft, Images, Save, Trash2 } from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AutoSaveIndicator from "./editor/AutoSaveIndicator";
import SummarySection from "./editor/SummarySection";
import LookaheadSection from "./editor/LookaheadSection";
import RisksSection from "./editor/RisksSection";
import DecisionsSection from "./editor/DecisionsSection";
import IncidentsSection from "./editor/IncidentsSection";
import ServerDivergenceAlert from "./editor/ServerDivergenceAlert";
import OfflineConflictAlert from "./editor/OfflineConflictAlert";
import PendingUploadsBanner from "./editor/PendingUploadsBanner";
import type { useEditorState } from "./editor/useEditorState";
import { equipeMobileLabels } from "@/content/equipeMobileLabels";
import { cn } from "@/lib/utils";

const L = equipeMobileLabels.relatorio;
const TOTAL = L.passos.length;
const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm";

interface WeeklyReportStepsMobileProps {
  state: ReturnType<typeof useEditorState>;
  onCancel?: () => void;
}

const isVideoUrl = (url: string) => url.includes("video") || url.endsWith(".mp4") || url.endsWith(".mov");
/** yyyy-mm-dd vira dd/mm; qualquer outro formato aparece como veio. */
const periodo = (value: string) => (/^\d{4}-\d{2}-\d{2}/.test(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}` : value);
const hasMarkup = (text: string) => /<[a-z][\s\S]*>/i.test(text);

const bigButtonClass = cn(
  "flex min-h-[72px] flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl text-[15px] font-semibold",
  "transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
);

export default function WeeklyReportStepsMobile({ state, onCancel }: WeeklyReportStepsMobileProps) {
  const [step, setStep] = useState(0);
  const cameraId = useId();
  const galleryId = useId();
  const { formData, uploadQueue } = state;

  const goTo = (next: number) => {
    setStep(Math.max(0, Math.min(TOTAL - 1, next)));
    // O conteúdo rola dentro do <main> da obra; volta ao topo do passo.
    document.getElementById("relatorio-passos-topo")?.scrollIntoView({ block: "start" });
  };

  const pendingIds = new Set(uploadQueue.pending.map((p) => p.id));
  const blockedIds = new Set(uploadQueue.blocked.map((p) => p.id));
  const fotos = formData.gallery;
  const enviando = fotos.filter((p) => pendingIds.has(p.id) && !blockedIds.has(p.id)).length;
  const atencaoCount = formData.risksAndIssues.length + formData.clientDecisions.length + formData.incidents.length;
  const resumoPreenchido = formData.executiveSummary.replace(/<[^>]*>/g, "").trim().length > 0;

  const uploadStatus = (id: string): string | null => {
    if (blockedIds.has(id)) return L.fotos.naoEnviada;
    if (!pendingIds.has(id)) return null;
    return uploadQueue.isProcessing ? L.fotos.enviando : L.fotos.naFila;
  };

  return (
    <div id="relatorio-passos-topo" className="flex flex-col">
      <header className="flex min-h-[60px] items-center gap-1 border-b border-border bg-card pl-2 pr-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label={L.voltar}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
        )}
        <div className={cn("flex min-w-0 flex-1 flex-col py-1.5", !onCancel && "pl-2")}>
          <h1 className="break-words text-base font-bold leading-tight text-foreground">{L.title(formData.weekNumber)}</h1>
          {/* Período e estado do salvamento na mesma linha, quebrando em
              tela estreita em vez de espremer o título. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="text-muted-foreground">
              {periodo(formData.periodStart)} a {periodo(formData.periodEnd)}
            </span>
            <AutoSaveIndicator
              status={state.isSaving ? "saving" : (state.autoSaveStatus ?? "idle")}
              lastSaved={state.lastSaved}
              retryInSeconds={state.retryInSeconds}
              errorMessage={state.autoSaveError}
              onRetry={state.retryAutoSave}
            />
          </div>
        </div>
      </header>

      <nav aria-label={L.passoDe(step + 1, TOTAL)} className="border-b border-border bg-card px-4 pt-2">
        <p className="text-sm font-medium text-foreground">
          {L.passoDe(step + 1, TOTAL)} · {L.passos[step]}
        </p>
        <ol className="-mt-1.5 grid grid-cols-5 gap-1.5">
          {L.passos.map((nome, i) => (
            <li key={nome}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-current={i === step ? "step" : undefined}
                aria-label={`${L.passoDe(i + 1, TOTAL)}: ${nome}`}
                className="flex min-h-[44px] w-full items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className={cn("h-1.5 w-full rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex flex-col gap-3 px-4 pt-4">
        <ServerDivergenceAlert check={state.serverCheck} onUseServerVersion={state.applyServerVersion} />
        <OfflineConflictAlert guard={state.offlineConflict} />
        <PendingUploadsBanner {...uploadQueue} />
      </div>

      <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
        {step === 0 && (
          <section aria-labelledby="passo-fotos" className="flex flex-col gap-4">
            <div>
              <h2 id="passo-fotos" className="text-xl font-bold text-foreground">
                {L.fotos.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{L.fotos.hint}</p>
            </div>

            <div className="flex gap-2.5">
              <input
                id={cameraId}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={state.handleBulkFileSelect}
              />
              <label htmlFor={cameraId} className={cn(bigButtonClass, "bg-primary text-primary-foreground")}>
                <Camera className="h-6 w-6" aria-hidden="true" />
                {L.fotos.tirar}
              </label>
              <input
                id={galleryId}
                type="file"
                accept={MEDIA_ACCEPT}
                multiple
                className="sr-only"
                onChange={state.handleBulkFileSelect}
              />
              <label htmlFor={galleryId} className={cn(bigButtonClass, "border border-border bg-card text-foreground")}>
                <Images className="h-6 w-6" aria-hidden="true" />
                {L.fotos.galeria}
              </label>
            </div>

            {fotos.length > 0 && (
              <p role="status" className="text-sm font-medium text-foreground">
                {L.fotos.contagem(fotos.length, enviando)}
              </p>
            )}

            <ul className="grid grid-cols-2 gap-2.5">
              {fotos.map((photo, index) => {
                const status = uploadStatus(photo.id);
                return (
                  <li key={photo.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                      {photo.url ? (
                        isVideoUrl(photo.url) ? (
                          <video src={photo.url} className="h-full w-full object-cover" controls />
                        ) : (
                          <img
                            src={photo.url}
                            alt={photo.caption || photo.area || L.fotos.foto(index + 1)}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        )
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                          {L.fotos.foto(index + 1)}
                        </span>
                      )}
                      {status && (
                        <span
                          className={cn(
                            "absolute inset-x-0 bottom-0 px-2 py-1 text-xs font-semibold",
                            blockedIds.has(photo.id)
                              ? "bg-destructive text-destructive-foreground"
                              : "bg-foreground/75 text-background",
                          )}
                        >
                          {status}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => state.removeGalleryPhoto(index)}
                        aria-label={L.fotos.remover(index + 1)}
                        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full bg-background/90 text-destructive shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Trash2 className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                    <Input
                      value={photo.area}
                      onChange={(e) => state.updateGalleryPhoto(index, "area", e.target.value)}
                      placeholder={L.fotos.ambientePlaceholder}
                      aria-label={`${L.fotos.ambiente}: ${L.fotos.foto(index + 1)}`}
                      className="h-11 text-base"
                    />
                    <Input
                      value={photo.caption}
                      onChange={(e) => state.updateGalleryPhoto(index, "caption", e.target.value)}
                      placeholder={L.fotos.legendaPlaceholder}
                      aria-label={`${L.fotos.legenda}: ${L.fotos.foto(index + 1)}`}
                      className="h-11 text-base"
                    />
                  </li>
                );
              })}
            </ul>

            <p className="rounded-xl bg-muted px-3.5 py-3 text-sm text-muted-foreground">{L.fotos.offline}</p>
          </section>
        )}

        {step === 1 && (
          <section aria-labelledby="passo-resumo" className="flex flex-col gap-3">
            <div>
              <h2 id="passo-resumo" className="text-xl font-bold text-foreground">
                {L.resumo.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{L.resumo.hint}</p>
            </div>
            {hasMarkup(formData.executiveSummary) ? (
              // Resumo já formatado (negrito, listas): mantém o editor de
              // texto de sempre, para não perder a formatação.
              <Accordion type="single" value="summary">
                <SummarySection
                  weekNumber={formData.weekNumber}
                  executiveSummary={formData.executiveSummary}
                  richTextOpen={state.richTextOpen}
                  setRichTextOpen={state.setRichTextOpen}
                  onUpdate={state.updateExecutiveSummary}
                />
              </Accordion>
            ) : (
              <Textarea
                value={formData.executiveSummary}
                onChange={(e) => state.updateExecutiveSummary(e.target.value)}
                placeholder={L.resumo.placeholder}
                aria-labelledby="passo-resumo"
                rows={8}
                className="min-h-[200px] text-base leading-relaxed"
              />
            )}
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="passo-proxima" className="flex flex-col gap-3">
            <div>
              <h2 id="passo-proxima" className="text-xl font-bold text-foreground">
                {L.proxima.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{L.proxima.hint}</p>
            </div>
            <Accordion type="single" value="lookahead">
              <LookaheadSection
                tasks={formData.lookaheadTasks}
                onAdd={state.addLookaheadTask}
                onUpdate={state.updateLookaheadTask}
                onRemove={state.removeLookaheadTask}
              />
            </Accordion>
          </section>
        )}

        {step === 3 && (
          <section aria-labelledby="passo-atencao" className="flex flex-col gap-3">
            <div>
              <h2 id="passo-atencao" className="text-xl font-bold text-foreground">
                {L.atencao.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{L.atencao.hint}</p>
            </div>
            <Accordion type="multiple" defaultValue={["risks", "decisions", "incidents"]} className="space-y-2">
              <RisksSection
                risks={formData.risksAndIssues}
                onAdd={state.addRiskIssue}
                onUpdate={state.updateRiskIssue}
                onRemove={state.removeRiskIssue}
              />
              <DecisionsSection
                decisions={formData.clientDecisions}
                onAdd={state.addClientDecision}
                onUpdate={state.updateClientDecision}
                onRemove={state.removeClientDecision}
              />
              <IncidentsSection
                incidents={formData.incidents}
                onAdd={state.addIncident}
                onUpdate={state.updateIncident}
                onRemove={state.removeIncident}
              />
            </Accordion>
          </section>
        )}

        {step === 4 && (
          <section aria-labelledby="passo-enviar" className="flex flex-col gap-3">
            <div>
              <h2 id="passo-enviar" className="text-xl font-bold text-foreground">
                {L.enviar.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{L.enviar.hint}</p>
            </div>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
              {[
                { ok: fotos.length > 0, text: L.enviar.fotos(fotos.length), step: 0 },
                { ok: resumoPreenchido, text: resumoPreenchido ? L.enviar.resumoOk : L.enviar.resumoFalta, step: 1 },
                { ok: formData.lookaheadTasks.length > 0, text: L.enviar.tarefas(formData.lookaheadTasks.length), step: 2 },
                { ok: true, text: L.enviar.atencao(atencaoCount), step: 3 },
              ].map((row) => (
                <li key={row.step} className="flex min-h-[56px] items-center gap-3 px-4">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      row.ok ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {row.ok && <Check className="h-4 w-4" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] text-foreground">
                    <span className="text-muted-foreground">{L.passos[row.step]}: </span>
                    {row.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => goTo(row.step)}
                    className="min-h-[44px] rounded-lg px-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {L.enviar.ir}
                  </button>
                </li>
              ))}
            </ul>
            {uploadQueue.pending.length > 0 && (
              <p role="status" className="rounded-xl bg-muted px-3.5 py-3 text-sm text-muted-foreground">
                {L.enviar.uploadsPendentes(uploadQueue.pending.length)}
              </p>
            )}
          </section>
        )}
      </div>

      {/* Rodapé fixo acima da barra inferior. `sticky` não serve aqui: o
          <main> da obra tem overflow próprio e não é quem rola. O espaçador
          guarda o lugar para o fim do conteúdo não ficar atrás da barra. Com o
          aviso de consentimento aberto, o rodapé sobe para cima dele. */}
      <div className="h-[4.5rem]" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-offset)+var(--consent-banner-offset,0px))] z-docked flex items-center gap-2 border-t border-border bg-card px-safe-4 py-3">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            aria-label={L.anterior}
            className="h-12 w-12 shrink-0 rounded-xl p-0"
            onClick={() => goTo(step - 1)}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
        )}
        {step < TOTAL - 1 ? (
          <Button type="button" className="h-12 flex-1 rounded-xl text-[15px] font-semibold" onClick={() => goTo(step + 1)}>
            {L.continuar(L.passos[step + 1])}
          </Button>
        ) : (
          <Button
            type="button"
            className="h-12 flex-1 rounded-xl text-[15px] font-semibold"
            disabled={state.isSaving}
            onClick={state.handleSave}
          >
            <Save className="mr-2 h-5 w-5" aria-hidden="true" />
            {state.isSaving ? L.enviar.salvando : L.enviar.salvar}
          </Button>
        )}
      </div>
    </div>
  );
}
