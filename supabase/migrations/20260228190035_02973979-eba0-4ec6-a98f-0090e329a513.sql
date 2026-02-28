
-- 1) ENUMS
do $$ begin
  create type review_status as enum ('draft', 'in_review', 'approved', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type review_comment_status as enum ('open', 'resolved');
exception
  when duplicate_object then null;
end $$;


-- 2) TABELA: ciclos de revisão por documento
create table if not exists public.project_document_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid not null,
  revision_number int not null default 1,
  status review_status not null default 'draft',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  file_path text,
  constraint project_document_reviews_revision_unique
    unique (document_id, revision_number)
);

create index if not exists idx_pdr_project on public.project_document_reviews(project_id);
create index if not exists idx_pdr_document on public.project_document_reviews(document_id);
create index if not exists idx_pdr_status on public.project_document_reviews(status);


-- 3) TABELA: comentários ancorados no PDF (por revisão)
create table if not exists public.project_document_review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.project_document_reviews(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid not null,
  page_number int not null check (page_number >= 1),
  x double precision not null check (x >= 0 and x <= 1),
  y double precision not null check (y >= 0 and y <= 1),
  rect_w double precision check (rect_w is null or (rect_w > 0 and rect_w <= 1)),
  rect_h double precision check (rect_h is null or (rect_h > 0 and rect_h <= 1)),
  parent_id uuid references public.project_document_review_comments(id) on delete cascade,
  status review_comment_status not null default 'open',
  author_id uuid not null,
  author_role text,
  message text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  tags text[] not null default '{}'
);

create index if not exists idx_pdr_comments_review on public.project_document_review_comments(review_id);
create index if not exists idx_pdr_comments_page on public.project_document_review_comments(review_id, page_number);
create index if not exists idx_pdr_comments_status on public.project_document_review_comments(review_id, status);
create index if not exists idx_pdr_comments_parent on public.project_document_review_comments(parent_id);


-- 4) RLS
alter table public.project_document_reviews enable row level security;
alter table public.project_document_review_comments enable row level security;

-- Reviews: SELECT para quem tem acesso ao projeto
create policy "pdr_select_project_access"
on public.project_document_reviews
for select
using (public.has_project_access(auth.uid(), project_id));

-- Reviews: INSERT apenas staff
create policy "pdr_insert_staff_only"
on public.project_document_reviews
for insert
with check (
  public.has_project_access(auth.uid(), project_id)
  and public.user_is_staff_or_above(auth.uid())
);

-- Reviews: UPDATE apenas staff
create policy "pdr_update_staff_only"
on public.project_document_reviews
for update
using (
  public.has_project_access(auth.uid(), project_id)
  and public.user_is_staff_or_above(auth.uid())
)
with check (
  public.has_project_access(auth.uid(), project_id)
  and public.user_is_staff_or_above(auth.uid())
);

-- Comments: SELECT para quem tem acesso ao projeto
create policy "pdr_comments_select_project_access"
on public.project_document_review_comments
for select
using (public.has_project_access(auth.uid(), project_id));

-- Comments: INSERT — cliente só se review está in_review; staff em draft/in_review
create policy "pdr_comments_insert_with_status_rules"
on public.project_document_review_comments
for insert
with check (
  public.has_project_access(auth.uid(), project_id)
  and (
    (
      -- Customer: only when review is in_review
      not public.user_is_staff_or_above(auth.uid())
      and exists (
        select 1 from public.project_document_reviews r
        where r.id = review_id and r.status = 'in_review'
      )
    )
    or
    (
      -- Staff: draft or in_review
      public.user_is_staff_or_above(auth.uid())
      and exists (
        select 1 from public.project_document_reviews r
        where r.id = review_id and r.status in ('draft', 'in_review')
      )
    )
  )
);

-- Comments: UPDATE apenas staff
create policy "pdr_comments_update_staff_only"
on public.project_document_review_comments
for update
using (
  public.has_project_access(auth.uid(), project_id)
  and public.user_is_staff_or_above(auth.uid())
)
with check (
  public.has_project_access(auth.uid(), project_id)
  and public.user_is_staff_or_above(auth.uid())
);
