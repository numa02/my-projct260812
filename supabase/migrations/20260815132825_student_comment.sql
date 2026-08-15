create type comment_creation_method as enum ('direct_ai', 'prompt_copy', 'manual');

create table student_comment (
  id uuid primary key default gen_random_uuid (),
  student_id uuid not null references student (id) on delete cascade,
  period_start_date date not null,
  period_end_date date not null,
  content text not null,
  target_char_count int,
  creation_method comment_creation_method not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, period_start_date, period_end_date)
);

alter table student_comment enable row level security;

grant select, insert, update, delete on student_comment to authenticated, service_role;

-- teacher_id を直接持たないため、student→class経由のサブクエリでポリシーを書く
create policy "teacher can manage own student comments" on student_comment
for all
  using (
    exists (
      select 1
      from student s
        join class c on c.id = s.class_id
      where
        s.id = student_comment.student_id
        and c.teacher_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1
      from student s
        join class c on c.id = s.class_id
      where
        s.id = student_comment.student_id
        and c.teacher_id = auth.uid ()
    )
  );
