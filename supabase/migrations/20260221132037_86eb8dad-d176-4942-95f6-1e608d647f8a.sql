
-- Add meeting_details_text column to journey_meeting_availability
-- This stores the free-text meeting details (e.g. Google Meet invite) pasted by the admin
ALTER TABLE public.journey_meeting_availability
ADD COLUMN IF NOT EXISTS meeting_details_text text;

-- Add comment for clarity
COMMENT ON COLUMN public.journey_meeting_availability.meeting_details_text IS 'Free-text meeting details (Google Meet invite) pasted by admin when scheduling';
