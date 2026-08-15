create table student (
  id uuid primary key default gen_random_uuid (),
  class_id uuid not null references class (id) on delete cascade,
  attendance_number int not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (class_id, attendance_number)
);

alter table student enable row level security;

grant select, insert, update, delete on student to authenticated, service_role;

-- teacher_id を直接持たないため、class経由のサブクエリでポリシーを書く
create policy "teacher can manage own students" on student
for all
  using (
    exists (
      select 1
      from class c
      where
        c.id = student.class_id
        and c.teacher_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1
      from class c
      where
        c.id = student.class_id
        and c.teacher_id = auth.uid ()
    )
  );
