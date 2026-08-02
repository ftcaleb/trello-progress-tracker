-- =====================================================================
-- 0010_project_roadmaps.sql
--
-- Per-project "Detailed Roadmap" PDFs. A private Storage bucket holds the
-- files; a metadata table lists them. Any project member (or admin) can
-- upload; members + admins of the project can list/open; the uploader or an
-- admin can delete. Access mirrors the existing is_member_of / is_admin
-- lockdown, so a non-member can neither list nor fetch a file.
--
-- Files live at:  {project_id}/{uuid}.pdf   (the first folder = project_id,
-- which the Storage policies read to authorize per project).
--
-- SAFETY: additive. New bucket + new table + new policies only. Nothing
-- existing is altered.
-- =====================================================================

-- --------------------------------------------------------------------
-- 1. Private bucket (PDF only, 20 MB cap).
-- --------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-roadmaps', 'project-roadmaps', false, 20971520, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = 20971520,
      allowed_mime_types = array['application/pdf'];

-- --------------------------------------------------------------------
-- 2. Metadata table — one row per uploaded PDF.
-- --------------------------------------------------------------------
create table if not exists public.project_documents (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  storage_path text not null,
  file_name    text not null,
  file_size    bigint,
  uploaded_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists project_documents_project_idx
  on public.project_documents (project_id);

alter table public.project_documents enable row level security;

drop policy if exists pd_select on public.project_documents;
create policy pd_select on public.project_documents
  for select to authenticated
  using (public.is_admin() or public.is_member_of(project_id));

drop policy if exists pd_insert on public.project_documents;
create policy pd_insert on public.project_documents
  for insert to authenticated
  with check (
    (public.is_admin() or public.is_member_of(project_id))
    and uploaded_by = auth.uid()
  );

drop policy if exists pd_delete on public.project_documents;
create policy pd_delete on public.project_documents
  for delete to authenticated
  using (public.is_admin() or uploaded_by = auth.uid());

-- --------------------------------------------------------------------
-- 3. Storage RLS on the bucket's objects. The project_id is the first
--    path segment; membership is checked against it.
-- --------------------------------------------------------------------
drop policy if exists roadmaps_read on storage.objects;
create policy roadmaps_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-roadmaps'
    and (
      public.is_admin()
      or public.is_member_of(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists roadmaps_insert on storage.objects;
create policy roadmaps_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-roadmaps'
    and (
      public.is_admin()
      or public.is_member_of(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists roadmaps_delete on storage.objects;
create policy roadmaps_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-roadmaps'
    and (public.is_admin() or owner = auth.uid())
  );

notify pgrst, 'reload schema';
