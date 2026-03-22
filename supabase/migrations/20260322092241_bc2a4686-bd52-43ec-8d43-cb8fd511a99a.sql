
-- Table for stage photos
CREATE TABLE public.journey_stage_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.journey_stages(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  storage_path text NOT NULL,
  caption text DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_journey_stage_photos_stage ON public.journey_stage_photos(stage_id);
CREATE INDEX idx_journey_stage_photos_project ON public.journey_stage_photos(project_id);

-- RLS
ALTER TABLE public.journey_stage_photos ENABLE ROW LEVEL SECURITY;

-- Anyone with project access can view photos
CREATE POLICY "Users with project access can view stage photos"
  ON public.journey_stage_photos FOR SELECT
  USING (has_project_access(auth.uid(), project_id));

-- Staff can manage photos
CREATE POLICY "Staff can manage stage photos"
  ON public.journey_stage_photos FOR ALL
  USING (is_staff(auth.uid()) AND has_project_access(auth.uid(), project_id));

-- Customers can upload photos to their projects
CREATE POLICY "Customers can insert stage photos"
  ON public.journey_stage_photos FOR INSERT
  WITH CHECK (
    has_project_access(auth.uid(), project_id)
    AND uploaded_by = auth.uid()
  );

-- Customers can delete their own photos
CREATE POLICY "Users can delete own stage photos"
  ON public.journey_stage_photos FOR DELETE
  USING (uploaded_by = auth.uid());
