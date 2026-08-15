create type share_flag as enum ('shared', 'private');

create table memo (
  id uuid primary key default gen_random_uuid (),
  student_id uuid not null references student (id) on delete cascade,
  subject_id uuid not null references subject (id) on delete restrict,
  note_date date not null,
  period int not null check (period between 1 and 6),
  content text not null,
  share_flag share_flag not null default 'shared',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, subject_id, note_date, period)
);

alter table memo enable row level security;

grant select, insert, update, delete on memo to authenticated, service_role;

-- teacher_id を直接持たないため、student→class経由のサブクエリでポリシーを書く
create policy "teacher can manage own memos" on memo
for all
  using (
    exists (
      select 1
      from student s
        join class c on c.id = s.class_id
      where
        s.id = memo.student_id
        and c.teacher_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1
      from student s
        join class c on c.id = s.class_id
      where
        s.id = memo.student_id
        and c.teacher_id = auth.uid ()
    )
  );
