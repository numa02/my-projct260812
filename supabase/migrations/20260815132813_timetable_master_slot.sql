create table timetable_master_slot (
  id uuid primary key default gen_random_uuid (),
  teacher_id uuid not null references teacher_profile (id) on delete cascade,
  weekday int not null check (weekday between 1 and 5),
  period int not null check (period between 1 and 6),
  subject_id uuid references subject (id) on delete set null,
  class_id uuid references class (id) on delete set null,
  unique (teacher_id, weekday, period)
);

alter table timetable_master_slot enable row level security;

grant select, insert, update, delete on timetable_master_slot to authenticated, service_role;

create policy "teacher can manage own timetable master slots" on timetable_master_slot
for all
  using (teacher_id = auth.uid ())
  with check (teacher_id = auth.uid ());
