create table weekly_subject_override (
  id uuid primary key default gen_random_uuid (),
  teacher_id uuid not null references teacher_profile (id) on delete cascade,
  week_start_date date not null,
  weekday int not null check (weekday between 1 and 5),
  period int not null check (period between 1 and 6),
  subject_id uuid references subject (id) on delete set null, -- null = 未設定(空きコマ)
  unique (teacher_id, week_start_date, weekday, period)
);

alter table weekly_subject_override enable row level security;

grant select, insert, update, delete on weekly_subject_override to authenticated, service_role;

create policy "teacher can manage own weekly subject overrides" on weekly_subject_override
for all
  using (teacher_id = auth.uid ())
  with check (teacher_id = auth.uid ());

create table weekly_class_override (
  id uuid primary key default gen_random_uuid (),
  teacher_id uuid not null references teacher_profile (id) on delete cascade,
  week_start_date date not null,
  weekday int not null check (weekday between 1 and 5),
  period int not null check (period between 1 and 6),
  class_id uuid not null references class (id) on delete cascade,
  unique (teacher_id, week_start_date, weekday, period)
);

alter table weekly_class_override enable row level security;

grant select, insert, update, delete on weekly_class_override to authenticated, service_role;

create policy "teacher can manage own weekly class overrides" on weekly_class_override
for all
  using (teacher_id = auth.uid ())
  with check (teacher_id = auth.uid ());
