import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MeetingSlot {
  id: string;
  stage_id: string;
  slot_datetime: string;
  duration_minutes: number;
  is_booked: boolean;
  booked_by: string | null;
  booked_at: string | null;
  created_at: string;
  created_by: string | null;
}

export function useMeetingSlots(stageId: string | undefined) {
  return useQuery({
    queryKey: ["meeting-slots", stageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journey_meeting_slots")
        .select("*")
        .eq("stage_id", stageId!)
        .order("slot_datetime", { ascending: true });

      if (error) throw error;
      return data as MeetingSlot[];
    },
    enabled: !!stageId,
  });
}

export function useAddMeetingSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stageId,
      slotDatetime,
      projectId,
    }: {
      stageId: string;
      slotDatetime: string;
      projectId: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from("journey_meeting_slots").insert({
        stage_id: stageId,
        slot_datetime: slotDatetime,
        created_by: user?.id,
      });

      if (error) throw error;
      return { stageId };
    },
    onSuccess: (_, { stageId }) => {
      queryClient.invalidateQueries({ queryKey: ["meeting-slots", stageId] });
    },
  });
}

export function useDeleteMeetingSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      slotId,
      projectId,
    }: {
      slotId: string;
      projectId: string;
    }) => {
      // First get the stageId for cache invalidation
      const { data: slot } = await supabase
        .from("journey_meeting_slots")
        .select("stage_id")
        .eq("id", slotId)
        .single();

      const { error } = await supabase
        .from("journey_meeting_slots")
        .delete()
        .eq("id", slotId);

      if (error) throw error;
      return { stageId: slot?.stage_id };
    },
    onSuccess: (result) => {
      if (result.stageId) {
        queryClient.invalidateQueries({
          queryKey: ["meeting-slots", result.stageId],
        });
      }
    },
  });
}

export function useBookMeetingSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      slotId,
      projectId,
      projectName,
      customerName,
      customerEmail,
      slotDatetime,
      stageName,
    }: {
      slotId: string;
      projectId: string;
      projectName: string;
      customerName: string;
      customerEmail: string;
      slotDatetime: string;
      stageName: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Get the stageId for cache invalidation
      const { data: slot } = await supabase
        .from("journey_meeting_slots")
        .select("stage_id")
        .eq("id", slotId)
        .single();

      // Update the slot to booked
      const { error: updateError } = await supabase
        .from("journey_meeting_slots")
        .update({
          is_booked: true,
          booked_by: user?.id,
          booked_at: new Date().toISOString(),
        })
        .eq("id", slotId);

      if (updateError) throw updateError;

      // Send email notification
      const { error: emailError } = await supabase.functions.invoke(
        "send-meeting-notification",
        {
          body: {
            slotId,
            projectName,
            customerName,
            customerEmail,
            slotDatetime,
            stageName,
          },
        },
      );

      if (emailError) {
        console.error("Error sending email notification:", emailError);
        // Don't throw - booking succeeded, email is secondary
      }

      return { stageId: slot?.stage_id };
    },
    onSuccess: (result) => {
      if (result.stageId) {
        queryClient.invalidateQueries({
          queryKey: ["meeting-slots", result.stageId],
        });
      }
    },
  });
}
