
ALTER TABLE public.non_conformities
  ADD COLUMN IF NOT EXISTS evidence_photos_before TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS evidence_photos_after TEXT[] DEFAULT '{}';

-- Copy existing evidence_photo_paths into evidence_photos_before
UPDATE public.non_conformities
SET evidence_photos_before = evidence_photo_paths
WHERE evidence_photo_paths IS NOT NULL AND array_length(evidence_photo_paths, 1) > 0;
