-- Bug: gallery photos saved a long-lived signed URL directly into
-- weekly_reports.data.gallery[].url. Once the signed URL expires the customer
-- sees a permanently broken image. The frontend now persists the storage
-- `path` and re-signs on every load, but existing rows have no `path`.
--
-- Fix: backfill `path` for every gallery element by parsing it out of the
-- saved URL (everything after `/weekly-reports/`, before the query string).
-- Elements that already have a path, or whose URL can't be parsed (blob:,
-- legacy CDN, etc.), are left untouched — the frontend resolver logs those.

DO $$
DECLARE
  r RECORD;
  new_gallery jsonb;
  elem jsonb;
  url text;
  marker text := '/weekly-reports/';
  tail text;
  qidx int;
  extracted text;
BEGIN
  FOR r IN
    SELECT id, data
    FROM public.weekly_reports
    WHERE data ? 'gallery'
      AND jsonb_typeof(data -> 'gallery') = 'array'
      AND jsonb_array_length(data -> 'gallery') > 0
  LOOP
    new_gallery := '[]'::jsonb;

    FOR elem IN SELECT * FROM jsonb_array_elements(r.data -> 'gallery')
    LOOP
      -- Keep elements that already have a usable path.
      IF (elem ? 'path')
         AND elem ->> 'path' IS NOT NULL
         AND elem ->> 'path' <> '' THEN
        new_gallery := new_gallery || elem;
        CONTINUE;
      END IF;

      url := elem ->> 'url';
      extracted := NULL;

      IF url IS NOT NULL AND position(marker IN url) > 0 THEN
        tail := substring(url FROM position(marker IN url) + length(marker));
        qidx := position('?' IN tail);
        IF qidx > 0 THEN
          extracted := substring(tail FROM 1 FOR qidx - 1);
        ELSE
          extracted := tail;
        END IF;
      END IF;

      IF extracted IS NOT NULL AND extracted <> '' THEN
        new_gallery := new_gallery
          || jsonb_set(elem, '{path}', to_jsonb(extracted));
      ELSE
        new_gallery := new_gallery || elem;
      END IF;
    END LOOP;

    UPDATE public.weekly_reports
    SET data = jsonb_set(data, '{gallery}', new_gallery)
    WHERE id = r.id;
  END LOOP;
END $$;
