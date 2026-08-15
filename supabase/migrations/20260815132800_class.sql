create table class_number_counter (
  id uuid primary key default gen_random_uuid (),
  teacher_id uuid not null references teacher_profile (id) on delete cascade,
  grade_group text not null, -- 通常学年の値、または '特支'
  last_issued_number int not null default 0,
  unique (teacher_id, grade_group)
);

alter table class_number_counter enable row level security;

grant select, insert, update, delete on class_number_counter to authenticated, service_role;

create policy "teacher can manage own class number counters" on class_number_counter
for all
  using (teacher_id = auth.uid ())
  with check (teacher_id = auth.uid ());

create table class (
  id uuid primary key default gen_random_uuid (),
  teacher_id uuid not null references teacher_profile (id) on delete cascade,
  grade text not null,
  group_number int not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (teacher_id, grade, group_number)
);

alter table class enable row level security;

grant select, insert, update, delete on class to authenticated, service_role;

create policy "teacher can manage own classes" on class
for all
  using (teacher_id = auth.uid ())
  with check (teacher_id = auth.uid ());
