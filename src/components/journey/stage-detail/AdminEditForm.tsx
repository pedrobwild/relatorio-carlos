import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { journeyCopy } from "@/constants/journeyCopy";
import {
  JourneyStage,
  JourneyStageStatus,
  useUpdateStage,
} from "@/hooks/useProjectJourney";

interface AdminEditFormProps {
  stage: JourneyStage;
  projectId: string;
  onClose: () => void;
}

export function AdminEditForm({
  stage,
  projectId,
  onClose,
}: AdminEditFormProps) {
  const [editData, setEditData] = useState({
    name: stage.name,
    description: stage.description || "",
    status: stage.status,
    cta_text: stage.cta_text || "",
    cta_visible: stage.cta_visible,
    microcopy: stage.microcopy || "",
    warning_text: stage.warning_text || "",
    dependencies_text: stage.dependencies_text || "",
    revision_text: stage.revision_text || "",
    responsible: stage.responsible || "",
  });

  const updateStage = useUpdateStage();

  const handleSave = () => {
    updateStage.mutate({
      stageId: stage.id,
      updates: {
        ...editData,
        description: editData.description || null,
        cta_text: editData.cta_text || null,
        microcopy: editData.microcopy || null,
        warning_text: editData.warning_text || null,
        dependencies_text: editData.dependencies_text || null,
        revision_text: editData.revision_text || null,
        responsible: editData.responsible || null,
      },
      projectId,
    });
    onClose();
  };

  return (
    <div
      className="space-y-4 p-4 bg-muted/30 rounded-lg border"
      role="form"
      aria-label={journeyCopy.admin.editStage}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm">
          {journeyCopy.admin.editStage}
        </span>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-11 w-11"
            aria-label={journeyCopy.a11y.cancelEdit}
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            onClick={handleSave}
            disabled={updateStage.isPending}
            className="h-11 w-11"
            aria-label={journeyCopy.a11y.saveEdit}
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            className="text-sm text-muted-foreground"
            htmlFor={`stage-name-${stage.id}`}
          >
            {journeyCopy.admin.fields.name}
          </label>
          <Input
            id={`stage-name-${stage.id}`}
            value={editData.name}
            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
          />
        </div>
        <div>
          <label
            className="text-sm text-muted-foreground"
            htmlFor={`stage-status-${stage.id}`}
          >
            {journeyCopy.admin.fields.status}
          </label>
          <Select
            value={editData.status}
            onValueChange={(v) =>
              setEditData({ ...editData, status: v as JourneyStageStatus })
            }
          >
            <SelectTrigger className="h-11" id={`stage-status-${stage.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">
                {journeyCopy.admin.statusOptions.pending}
              </SelectItem>
              <SelectItem value="waiting_action">
                {journeyCopy.admin.statusOptions.waiting_action}
              </SelectItem>
              <SelectItem value="in_progress">
                {journeyCopy.admin.statusOptions.in_progress}
              </SelectItem>
              <SelectItem value="completed">
                {journeyCopy.admin.statusOptions.completed}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <label
          className="text-sm text-muted-foreground"
          htmlFor={`stage-desc-${stage.id}`}
        >
          {journeyCopy.admin.fields.description}
        </label>
        <Textarea
          id={`stage-desc-${stage.id}`}
          value={editData.description}
          onChange={(e) =>
            setEditData({ ...editData, description: e.target.value })
          }
          rows={4}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            className="text-sm text-muted-foreground"
            htmlFor={`stage-cta-${stage.id}`}
          >
            {journeyCopy.admin.fields.ctaText}
          </label>
          <Input
            id={`stage-cta-${stage.id}`}
            value={editData.cta_text}
            onChange={(e) =>
              setEditData({ ...editData, cta_text: e.target.value })
            }
          />
        </div>
        <div>
          <label
            className="text-sm text-muted-foreground"
            htmlFor={`stage-resp-${stage.id}`}
          >
            {journeyCopy.admin.fields.responsible}
          </label>
          <Input
            id={`stage-resp-${stage.id}`}
            value={editData.responsible}
            onChange={(e) =>
              setEditData({ ...editData, responsible: e.target.value })
            }
          />
        </div>
      </div>
      <div>
        <label
          className="text-sm text-muted-foreground"
          htmlFor={`stage-micro-${stage.id}`}
        >
          {journeyCopy.admin.fields.microcopy}
        </label>
        <Input
          id={`stage-micro-${stage.id}`}
          value={editData.microcopy}
          onChange={(e) =>
            setEditData({ ...editData, microcopy: e.target.value })
          }
        />
      </div>
      <div>
        <label
          className="text-sm text-muted-foreground"
          htmlFor={`stage-warn-${stage.id}`}
        >
          {journeyCopy.admin.fields.warning}
        </label>
        <Input
          id={`stage-warn-${stage.id}`}
          value={editData.warning_text}
          onChange={(e) =>
            setEditData({ ...editData, warning_text: e.target.value })
          }
        />
      </div>
      <div>
        <label
          className="text-sm text-muted-foreground"
          htmlFor={`stage-deps-${stage.id}`}
        >
          {journeyCopy.admin.fields.dependencies}
        </label>
        <Textarea
          id={`stage-deps-${stage.id}`}
          value={editData.dependencies_text}
          onChange={(e) =>
            setEditData({ ...editData, dependencies_text: e.target.value })
          }
          rows={2}
        />
      </div>
      <div>
        <label
          className="text-sm text-muted-foreground"
          htmlFor={`stage-rev-${stage.id}`}
        >
          {journeyCopy.admin.fields.revisions}
        </label>
        <Input
          id={`stage-rev-${stage.id}`}
          value={editData.revision_text}
          onChange={(e) =>
            setEditData({ ...editData, revision_text: e.target.value })
          }
        />
      </div>
    </div>
  );
}
