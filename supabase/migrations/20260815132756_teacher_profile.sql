-- 教員プロフィール。auth.users を拡張する形で持つ。
-- email は auth.users 側にのみ存在し、こちらには複製しない
-- (二重管理によるズレを避けるため。UI表示が必要な場合はセッションから取得する)
create table teacher_profile (
  id uuid primary key references auth.users (id) on delete cascade,
  start_date date, -- 起算日。未設定はnull
  created_at timestamptz not null default now()
);

alter table teacher_profile enable row level security;

grant select, update on teacher_profile to authenticated, service_role;

create policy "teacher can view own profile" on teacher_profile for select using (id = auth.uid());

create policy "teacher can update own profile" on teacher_profile
for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- auth.users への新規登録時に teacher_profile を自動作成するトリガー
-- (F8「サインアップ直後から利用できる」を満たすために必須)
create function handle_new_teacher () returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.teacher_profile (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row
execute function handle_new_teacher ();
