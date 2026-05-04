import { useState, useRef, useCallback, useEffect } from "react";
import {
  WeeklyReportData,
  LookaheadTask,
  RiskIssue,
  ClientDecision,
  Incident,
  GalleryPhoto,
} from "@/types/weeklyReport";
import { useAutoSave } from "@/hooks/useAutoSave";
import { toast } from "sonner";

interface UseEditorStateOptions {
  data: WeeklyReportData;
  onAutoSave?: (updatedData: WeeklyReportData) => void | Promise<void>;
  onSaveAndClose?: (updatedData: WeeklyReportData) => void;
  externalIsSaving?: boolean;
}

const validTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function validateFile(file: File): boolean {
  if (!validTypes.includes(file.type)) {
    toast.error(
      `Formato não suportado: ${file.name}. Use JPG, PNG, WEBP, MP4 ou MOV.`,
    );
    return false;
  }
  if (file.size > MAX_FILE_SIZE) {
    toast.error(`Arquivo muito grande: ${file.name}. Máximo 50MB.`);
    return false;
  }
  return true;
}

export function useEditorState({
  data,
  onAutoSave,
  onSaveAndClose,
  externalIsSaving,
}: UseEditorStateOptions) {
  const [formData, setFormData] = useState<WeeklyReportData>(data);
  const [richTextOpen, setRichTextOpen] = useState(false);
  const hasUserEdited = useRef(false);

  // Sync formData when external data changes (e.g. refetch), but only if user hasn't edited
  useEffect(() => {
    if (!hasUserEdited.current) {
      setFormData(data);
    }
  }, [data]);

  // Wrap setFormData to track user edits
  const setFormDataWithTracking = useCallback(
    (
      updater:
        | WeeklyReportData
        | ((prev: WeeklyReportData) => WeeklyReportData),
    ) => {
      hasUserEdited.current = true;
      setFormData(updater);
    },
    [],
  );

  const { isSaving: autoSaving, lastSaved } = useAutoSave({
    data: formData,
    onSave: async (payload) => {
      await onAutoSave?.(payload);
    },
    debounceMs: 3000,
    enabled: !!onAutoSave,
  });

  const isSaving = externalIsSaving || autoSaving;

  const handleSave = () => onSaveAndClose?.(formData);

  const updateExecutiveSummary = (value: string) => {
    setFormDataWithTracking((prev) => ({ ...prev, executiveSummary: value }));
  };

  // --- Lookahead Tasks ---
  const addLookaheadTask = () => {
    const newTask: LookaheadTask = {
      id: `task-${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      description: "",
      prerequisites: "",
      responsible: "",
      risk: "baixo",
    };
    setFormDataWithTracking((prev) => ({
      ...prev,
      lookaheadTasks: [...prev.lookaheadTasks, newTask],
    }));
  };

  const updateLookaheadTask = (
    index: number,
    field: keyof LookaheadTask,
    value: string,
  ) => {
    setFormDataWithTracking((prev) => ({
      ...prev,
      lookaheadTasks: prev.lookaheadTasks.map((task, i) =>
        i === index ? { ...task, [field]: value } : task,
      ),
    }));
  };

  const removeLookaheadTask = (index: number) => {
    setFormDataWithTracking((prev) => ({
      ...prev,
      lookaheadTasks: prev.lookaheadTasks.filter((_, i) => i !== index),
    }));
  };

  // --- Risks and Issues ---
  const addRiskIssue = () => {
    const newRisk: RiskIssue = {
      id: `risk-${Date.now()}`,
      type: "risco",
      title: "",
      description: "",
      impact: { time: "baixo", cost: "baixo", quality: "baixo" },
      severity: "baixa",
      actionPlan: "",
      owner: "",
      dueDate: new Date().toISOString().split("T")[0],
      status: "aberto",
    };
    setFormDataWithTracking((prev) => ({
      ...prev,
      risksAndIssues: [...prev.risksAndIssues, newRisk],
    }));
  };

  const updateRiskIssue = (index: number, updates: Partial<RiskIssue>) => {
    setFormDataWithTracking((prev) => ({
      ...prev,
      risksAndIssues: prev.risksAndIssues.map((risk, i) =>
        i === index ? { ...risk, ...updates } : risk,
      ),
    }));
  };

  const removeRiskIssue = (index: number) => {
    setFormDataWithTracking((prev) => ({
      ...prev,
      risksAndIssues: prev.risksAndIssues.filter((_, i) => i !== index),
    }));
  };

  // --- Client Decisions ---
  const addClientDecision = () => {
    const newDecision: ClientDecision = {
      id: `decision-${Date.now()}`,
      description: "",
      impactIfDelayed: "",
      dueDate: new Date().toISOString().split("T")[0],
      status: "pending",
    };
    setFormDataWithTracking((prev) => ({
      ...prev,
      clientDecisions: [...prev.clientDecisions, newDecision],
    }));
  };

  const updateClientDecision = (
    index: number,
    field: keyof ClientDecision,
    value: string,
  ) => {
    setFormDataWithTracking((prev) => ({
      ...prev,
      clientDecisions: prev.clientDecisions.map((d, i) =>
        i === index ? { ...d, [field]: value } : d,
      ),
    }));
  };

  const removeClientDecision = (index: number) => {
    setFormDataWithTracking((prev) => ({
      ...prev,
      clientDecisions: prev.clientDecisions.filter((_, i) => i !== index),
    }));
  };

  // --- Incidents ---
  const addIncident = () => {
    const newIncident: Incident = {
      id: `incident-${Date.now()}`,
      occurrence: "",
      occurrenceDate: new Date().toISOString().split("T")[0],
      cause: "",
      action: "",
      impact: "",
      status: "aberto",
      expectedResolutionDate: new Date().toISOString().split("T")[0],
    };
    setFormDataWithTracking((prev) => ({
      ...prev,
      incidents: [...prev.incidents, newIncident],
    }));
  };

  const updateIncident = (
    index: number,
    field: keyof Incident,
    value: string,
  ) => {
    setFormDataWithTracking((prev) => ({
      ...prev,
      incidents: prev.incidents.map((inc, i) =>
        i === index ? { ...inc, [field]: value } : inc,
      ),
    }));
  };

  const removeIncident = (index: number) => {
    setFormDataWithTracking((prev) => ({
      ...prev,
      incidents: prev.incidents.filter((_, i) => i !== index),
    }));
  };

  // --- Gallery ---
  const addGalleryPhoto = () => {
    const newPhoto: GalleryPhoto = {
      id: `photo-${Date.now()}`,
      url: "",
      caption: "",
      area: "",
      date: new Date().toISOString().split("T")[0],
      category: "progresso",
    };
    setFormDataWithTracking((prev) => ({
      ...prev,
      gallery: [...prev.gallery, newPhoto],
    }));
  };

  const updateGalleryPhoto = (
    index: number,
    field: keyof GalleryPhoto,
    value: string,
  ) => {
    setFormDataWithTracking((prev) => ({
      ...prev,
      gallery: prev.gallery.map((p, i) =>
        i === index ? { ...p, [field]: value } : p,
      ),
    }));
  };

  const removeGalleryPhoto = (index: number) => {
    setFormDataWithTracking((prev) => {
      const removed = prev.gallery[index];
      if (removed?.url?.startsWith("blob:")) {
        URL.revokeObjectURL(removed.url);
      }
      return { ...prev, gallery: prev.gallery.filter((_, i) => i !== index) };
    });
  };

  const handleFileSelect = async (
    index: number,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !validateFile(file)) return;
    const localUrl = URL.createObjectURL(file);
    updateGalleryPhoto(index, "url", localUrl);
    toast.success(
      "Arquivo selecionado! O upload será feito ao salvar o relatório.",
    );
    event.target.value = "";
  };

  const handleBulkFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      if (validateFile(file)) validFiles.push(file);
    }
    if (validFiles.length === 0) return;
    const newPhotos: GalleryPhoto[] = validFiles.map((file, idx) => ({
      id: `photo-${Date.now()}-${idx}`,
      url: URL.createObjectURL(file),
      caption: "",
      area: "",
      date: new Date().toISOString().split("T")[0],
      category: "progresso",
    }));
    setFormDataWithTracking((prev) => ({
      ...prev,
      gallery: [...prev.gallery, ...newPhotos],
    }));
    toast.success(
      `${validFiles.length} arquivo(s) adicionado(s)! O upload será feito ao salvar.`,
    );
    event.target.value = "";
  };

  return {
    formData,
    setFormData,
    richTextOpen,
    setRichTextOpen,
    isSaving,
    lastSaved,
    handleSave,
    updateExecutiveSummary,
    // Lookahead
    addLookaheadTask,
    updateLookaheadTask,
    removeLookaheadTask,
    // Risks
    addRiskIssue,
    updateRiskIssue,
    removeRiskIssue,
    // Decisions
    addClientDecision,
    updateClientDecision,
    removeClientDecision,
    // Incidents
    addIncident,
    updateIncident,
    removeIncident,
    // Gallery
    addGalleryPhoto,
    updateGalleryPhoto,
    removeGalleryPhoto,
    handleFileSelect,
    handleBulkFileSelect,
  };
}
