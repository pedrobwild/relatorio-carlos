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
import { usePhotoUploadQueue } from "@/hooks/usePhotoUploadQueue";
import {
  enqueuePhotoUpload,
  removePendingUpload,
} from "@/lib/photoUploadQueue";
import { toast } from "sonner";
import { useServerStateCheck } from "./useServerStateCheck";


interface UseEditorStateOptions {
  data: WeeklyReportData;
  /** Necessário para a verificação de divergência com o servidor. */
  projectId?: string;
  // When a handler returns the persisted WeeklyReportData (i.e. the upload
  // pipeline replaced blob: URLs with permanent ones), the editor patches its
  // local formData.gallery so previews stay valid and subsequent saves don't
  // try to re-upload the same blobs.
  onAutoSave?: (
    updatedData: WeeklyReportData,
  ) => void | Promise<WeeklyReportData | null | undefined | void>;
  onSaveAndClose?: (
    updatedData: WeeklyReportData,
  ) => void | Promise<WeeklyReportData | null | undefined | void>;
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
  projectId,
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

  // Replace blob: URLs in formData.gallery with the persisted url/path that
  // came back from the save pipeline, matching by photo id. Revoke any blob
  // URLs we just replaced so they don't leak memory.
  const syncGalleryFromPersisted = useCallback(
    (persisted: WeeklyReportData | null | undefined | void) => {
      if (!persisted || !persisted.gallery) return;
      const persistedById = new Map<string, GalleryPhoto>();
      for (const p of persisted.gallery) persistedById.set(p.id, p);
      setFormData((prev) => {
        let mutated = false;
        const toRevoke: string[] = [];
        const nextGallery = prev.gallery.map((photo) => {
          if (!photo.url?.startsWith("blob:")) return photo;
          const saved = persistedById.get(photo.id);
          if (!saved?.url || saved.url.startsWith("blob:")) return photo;
          mutated = true;
          toRevoke.push(photo.url);
          // Já persistido pelo pipeline de save: sai da fila de reenvio.
          void removePendingUpload(photo.id);
          return { ...photo, url: saved.url, path: saved.path ?? photo.path };

        });
        if (!mutated) return prev;
        for (const url of toRevoke) URL.revokeObjectURL(url);
        return { ...prev, gallery: nextGallery };
      });
    },
    [],
  );

  // Verificação de divergência no carregamento: enquanto ela roda (ou

  // enquanto uma divergência não é resolvida), o autosave fica suspenso.
  const serverCheck = useServerStateCheck({
    projectId,
    weekNumber: data.weekNumber,
    localData: formData,
    enabled: !!projectId && !!onAutoSave,
  });

  const {
    isSaving: autoSaving,
    lastSaved,
    status: autoSaveStatus,
    retryInSeconds,
    errorMessage: autoSaveError,
    saveNow: retryAutoSave,
  } = useAutoSave({
    data: formData,
    onSave: async (payload) => {
      const result = await onAutoSave?.(payload);
      syncGalleryFromPersisted(result);
      // Hand the persisted shape back to useAutoSave so it doesn't think
      // the post-sync formData (blob: → signed URL) is an unsaved change.
      return result ?? undefined;
    },
    debounceMs: 3000,
    enabled: !!onAutoSave && !serverCheck.blocksAutoSave,
  });

  // Aplica a versão do servidor sobre o estado local e libera o autosave.
  const applyServerVersion = useCallback(() => {
    if (serverCheck.serverData) {
      hasUserEdited.current = false;
      setFormData(serverCheck.serverData);
    }
    serverCheck.acceptServer();
  }, [serverCheck]);


  const isSaving = externalIsSaving || autoSaving;

  const handleSave = async () => {
    try {
      const result = await onSaveAndClose?.(formData);
      syncGalleryFromPersisted(result);
    } catch (err) {
      // Toast is already shown by the save pipeline; swallow to avoid
      // unhandled promise rejections in React event handlers.
      console.error("Manual save failed:", err);
    }
  };

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
    // Revoke a previously-picked blob in the same slot (user replacing
    // their selection before save) so it doesn't leak until tab close.
    const previousUrl = formData.gallery[index]?.url;
    if (previousUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previousUrl);
    }
    const localUrl = URL.createObjectURL(file);
    const photoId = formData.gallery[index]?.id;
    updateGalleryPhoto(index, "url", localUrl);
    if (projectId && photoId) {
      // Guarda os bytes no aparelho para que o envio sobreviva a navegação,
      // perda de sinal ou descarte da aba no celular.
      await enqueuePhotoUpload({
        id: photoId,
        projectId,
        weekNumber: formData.weekNumber,
        blob: file,
        mimeType: file.type,
        fileName: file.name,
      });
    }
    toast.success("Arquivo selecionado! O envio começa automaticamente.");
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
    if (projectId) {
      await Promise.all(
        newPhotos.map((photo, idx) =>
          enqueuePhotoUpload({
            id: photo.id,
            projectId,
            weekNumber: formData.weekNumber,
            blob: validFiles[idx],
            mimeType: validFiles[idx].type,
            fileName: validFiles[idx].name,
          }),
        ),
      );
    }
    toast.success(
      `${validFiles.length} arquivo(s) adicionado(s)! O envio começa automaticamente.`,
    );
    event.target.value = "";
  };


  return {
    formData,
    setFormData,
    serverCheck,
    applyServerVersion,
    richTextOpen,
    setRichTextOpen,
    isSaving,
    lastSaved,
    autoSaveStatus,
    retryInSeconds,
    autoSaveError,
    retryAutoSave,
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
