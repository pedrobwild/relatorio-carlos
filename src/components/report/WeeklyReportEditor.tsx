import { WeeklyReportData } from "@/types/weeklyReport";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import { useEditorState } from "./editor/useEditorState";
import EditorHeader from "./editor/EditorHeader";
import SummarySection from "./editor/SummarySection";
import LookaheadSection from "./editor/LookaheadSection";
import RisksSection from "./editor/RisksSection";
import DecisionsSection from "./editor/DecisionsSection";
import IncidentsSection from "./editor/IncidentsSection";
import GallerySection from "./editor/GallerySection";
import { AIReportGenerator } from "./AIReportGenerator";
import { WeeklyReportVersionHistory } from "./WeeklyReportVersionHistory";
import ServerDivergenceAlert from "./editor/ServerDivergenceAlert";



interface WeeklyReportEditorProps {
  data: WeeklyReportData;
  projectId?: string;
  // Handlers may return the persisted data so the editor can replace blob:
  // URLs in its local state with the permanent signed URLs.
  onAutoSave?: (
    updatedData: WeeklyReportData,
  ) => void | Promise<WeeklyReportData | null | undefined | void>;
  onSaveAndClose?: (
    updatedData: WeeklyReportData,
  ) => void | Promise<WeeklyReportData | null | undefined | void>;
  onCancel?: () => void;
  isSaving?: boolean;
}

const WeeklyReportEditor = ({
  data,
  projectId,
  onAutoSave,
  onSaveAndClose,
  onCancel,
  isSaving: externalIsSaving,
}: WeeklyReportEditorProps) => {
  const state = useEditorState({
    data,
    projectId,
    onAutoSave,
    onSaveAndClose,
    externalIsSaving,
  });

  const handleAIGenerated = (updatedData: WeeklyReportData) => {
    state.setFormData(updatedData);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <EditorHeader
            weekNumber={state.formData.weekNumber}
            periodStart={state.formData.periodStart}
            periodEnd={state.formData.periodEnd}
            isSaving={state.isSaving}
            lastSaved={state.lastSaved}
            onSave={state.handleSave}
            onCancel={onCancel}
          />
        </div>
      </div>

      <ServerDivergenceAlert
        check={state.serverCheck}
        onUseServerVersion={state.applyServerVersion}
      />


      {projectId && (
        <div className="flex flex-wrap justify-end gap-2">
          <WeeklyReportVersionHistory
            projectId={projectId}
            weekNumber={state.formData.weekNumber}
            onRestored={(restored) => state.setFormData(restored)}
          />
          <AIReportGenerator
            projectId={projectId}
            weekNumber={state.formData.weekNumber}
            weekStart={state.formData.periodStart}
            weekEnd={state.formData.periodEnd}
            currentData={state.formData}
            onGenerated={handleAIGenerated}
          />
        </div>
      )}


      <Accordion
        type="multiple"
        defaultValue={["summary", "lookahead"]}
        className="space-y-2"
      >
        <SummarySection
          weekNumber={state.formData.weekNumber}
          executiveSummary={state.formData.executiveSummary}
          richTextOpen={state.richTextOpen}
          setRichTextOpen={state.setRichTextOpen}
          onUpdate={state.updateExecutiveSummary}
        />
        <LookaheadSection
          tasks={state.formData.lookaheadTasks}
          onAdd={state.addLookaheadTask}
          onUpdate={state.updateLookaheadTask}
          onRemove={state.removeLookaheadTask}
        />
        <RisksSection
          risks={state.formData.risksAndIssues}
          onAdd={state.addRiskIssue}
          onUpdate={state.updateRiskIssue}
          onRemove={state.removeRiskIssue}
        />
        <DecisionsSection
          decisions={state.formData.clientDecisions}
          onAdd={state.addClientDecision}
          onUpdate={state.updateClientDecision}
          onRemove={state.removeClientDecision}
        />
        <IncidentsSection
          incidents={state.formData.incidents}
          onAdd={state.addIncident}
          onUpdate={state.updateIncident}
          onRemove={state.removeIncident}
        />
        <GallerySection
          photos={state.formData.gallery}
          onAdd={state.addGalleryPhoto}
          onUpdate={state.updateGalleryPhoto}
          onRemove={state.removeGalleryPhoto}
          onFileSelect={state.handleFileSelect}
          onBulkFileSelect={state.handleBulkFileSelect}
        />
      </Accordion>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button onClick={state.handleSave} disabled={state.isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {state.isSaving ? "Salvando..." : "Salvar Relatório"}
        </Button>
      </div>
    </div>
  );
};

export default WeeklyReportEditor;
