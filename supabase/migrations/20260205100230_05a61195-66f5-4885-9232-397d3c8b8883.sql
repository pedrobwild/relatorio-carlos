-- Meeting slots table for admin to define available times
CREATE TABLE public.journey_meeting_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID REFERENCES public.journey_stages(id) ON DELETE CASCADE NOT NULL,
  slot_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  is_booked BOOLEAN DEFAULT FALSE,
  booked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  booked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.journey_meeting_slots ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view slots for their project stages
CREATE POLICY "Users can view meeting slots for their project stages"
ON public.journey_meeting_slots
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM journey_stages js
    JOIN project_members pm ON pm.project_id = js.project_id
    WHERE js.id = journey_meeting_slots.stage_id
    AND pm.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'engineer', 'manager')
  )
);

-- Staff can insert/update/delete slots
CREATE POLICY "Staff can manage meeting slots"
ON public.journey_meeting_slots
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'engineer', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'engineer', 'manager')
  )
);

-- Customers can only update to book a slot (set is_booked = true)
CREATE POLICY "Customers can book available slots"
ON public.journey_meeting_slots
FOR UPDATE
TO authenticated
USING (
  is_booked = FALSE
  AND EXISTS (
    SELECT 1 FROM journey_stages js
    JOIN project_members pm ON pm.project_id = js.project_id
    WHERE js.id = journey_meeting_slots.stage_id
    AND pm.user_id = auth.uid()
    AND pm.role = 'customer'
  )
)
WITH CHECK (
  is_booked = TRUE
  AND booked_by = auth.uid()
);

-- Index for performance
CREATE INDEX idx_meeting_slots_stage_id ON public.journey_meeting_slots(stage_id);
CREATE INDEX idx_meeting_slots_datetime ON public.journey_meeting_slots(slot_datetime);
CREATE INDEX idx_meeting_slots_is_booked ON public.journey_meeting_slots(is_booked);