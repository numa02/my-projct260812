create type ai_provider as enum ('openai', 'anthropic', 'gemini');

create table ai_provider_setting (
  id uuid primary key default gen_random_uuid (),
  teacher_id uuid not null unique references teacher_profile (id) on delete cascade,
  provider ai_provider not null,
  model text not null,
  encrypted_api_key text not null, -- base64(iv(12byte) || ciphertext || authTag), AES-256-GCM, AAD=teacher_id
  updated_at timestamptz not null default now()
);

alter table ai_provider_setting enable row level security;

grant select, insert, update, delete on ai_provider_setting to authenticated, service_role;

create policy "teacher can manage own ai provider setting" on ai_provider_setting
for all
  using (teacher_id = auth.uid ())
  with check (teacher_id = auth.uid ());

create table prompt_template (
  id uuid primary key default gen_random_uuid (),
  teacher_id uuid not null unique references teacher_profile (id) on delete cascade,
  content text not null,
  updated_at timestamptz not null default now()
);

alter table prompt_template enable row level security;

grant select, insert, update, delete on prompt_template to authenticated, service_role;

create policy "teacher can manage own prompt template" on prompt_template
for all
  using (teacher_id = auth.uid ())
  with check (teacher_id = auth.uid ());
