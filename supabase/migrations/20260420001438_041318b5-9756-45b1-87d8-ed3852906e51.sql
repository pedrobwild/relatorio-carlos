-- Fix week numbers for DEMO project: dates 2026-03-16 and 2026-03-23 correspond to weeks 9 and 10
-- (project planned_start_date is 2026-01-19), not 11/12 as originally inserted.
-- Use a temporary offset to avoid unique constraint conflicts.
UPDATE public.weekly_reports 
SET week_number = week_number + 100
WHERE project_id = 'fc1eb067-a7d9-41e1-bd39-1845e750c3b7' AND week_number IN (11, 12);

UPDATE public.weekly_reports 
SET week_number = 9,
    data = jsonb_set(data, '{weekNumber}', '9'::jsonb)
WHERE project_id = 'fc1eb067-a7d9-41e1-bd39-1845e750c3b7' AND week_number = 111;

UPDATE public.weekly_reports 
SET week_number = 10,
    data = jsonb_set(data, '{weekNumber}', '10'::jsonb)
WHERE project_id = 'fc1eb067-a7d9-41e1-bd39-1845e750c3b7' AND week_number = 112;