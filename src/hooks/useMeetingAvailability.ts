import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type MeetingStatus = "pending_confirmation" | "confirmed" | "cancelled";

export interface MeetingAvailability {
  id: string;
  stage_id: string;
  project_id: string;
  submitted_by: string;
  submitted_at: string;
  start_date: string;
  end_date: string;
  preferred_weekdays: string[];
  time_slots: string[];
  notes: string | null;
  status: MeetingStatus;
  confirmed_datetime: string | null;
  confirmed_by: string | null;
  meeting_details_text: string | null;
}

/** Derived state machine status for the 3-state flow */
export type BriefingMeetingState =
  | "needs_availability"
  | "awaiting_scheduling"
  | "scheduled";

export function deriveMeetingState(
  availability: MeetingAvailability | null,
): BriefingMeetingState {
  if (!availability) return "needs_availability";
  if (availability.status === "confirmed") return "scheduled";
  return "awaiting_scheduling";
}

export function useMeetingAvailability(
  stageId: string | undefined,
  projectId: string | undefined,
) {
  return useQuery({
    queryKey: ["meeting-availability", stageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journey_meeting_availability")
        .select("*")
        .eq("stage_id", stageId!)
        .eq("project_id", projectId!)
        .order("submitted_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = data?.[0] ?? null;
      return row as MeetingAvailability | null;
    },
    enabled: !!stageId && !!projectId,
  });
}

export function useSubmitMeetingAvailability() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      stage_id: string;
      project_id: string;
      submitted_by: string;
      start_date: string;
      end_date: string;
      preferred_weekdays: string[];
      time_slots: string[];
      notes?: string;
    }) => {
      // Upsert: delete previous pending then insert
      await supabase
        .from("journey_meeting_availability")
        .delete()
        .eq("stage_id", input.stage_id)
        .eq("project_id", input.project_id)
        .eq("status", "pending_confirmation");

      const { error } = await supabase
        .from("journey_meeting_availability")
        .insert({
          stage_id: input.stage_id,
          project_id: input.project_id,
          submitted_by: input.submitted_by,
          start_date: input.start_date,
          end_date: input.end_date,
          preferred_weekdays: input.preferred_weekdays,
          time_slots: input.time_slots,
          notes: input.notes || null,
        });
      if (error) throw error;
      return { stageId: input.stage_id };
    },
    onSuccess: ({ stageId }) => {
      qc.invalidateQueries({ queryKey: ["meeting-availability", stageId] });
      toast.success("Disponibilidade enviada com sucesso.");
    },
    onError: () => {
      toast.error(
        "Não foi possível enviar sua disponibilidade. Tente novamente.",
      );
    },
  });
}

export function useScheduleMeeting() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      availability_id: string;
      stage_id: string;
      confirmed_datetime: string;
      meeting_details_text: string;
      confirmed_by: string;
    }) => {
      const { error } = await supabase
        .from("journey_meeting_availability")
        .update({
          status: "confirmed",
          confirmed_datetime: input.confirmed_datetime,
          confirmed_by: input.confirmed_by,
          meeting_details_text: input.meeting_details_text,
        })
        .eq("id", input.availability_id);
      if (error) throw error;
      return { stageId: input.stage_id };
    },
    onSuccess: ({ stageId }) => {
      qc.invalidateQueries({ queryKey: ["meeting-availability", stageId] });
      toast.success("Reunião agendada com sucesso.");
    },
    onError: () => {
      toast.error("Não foi possível agendar a reunião. Tente novamente.");
    },
  });
}
