-- 科目名の重複は許可する(再ヒアリングでの決定)。ユニーク制約は設けない
create table subject (
  id uuid primary key default gen_random_uuid (),
  teacher_id uuid not null references teacher_profile (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table subject enable row level security;

grant select, insert, update, delete on subject to authenticated, service_role;

create policy "teacher can manage own subjects" on subject
for all
  using (teacher_id = auth.uid ())
  with check (teacher_id = auth.uid ());
