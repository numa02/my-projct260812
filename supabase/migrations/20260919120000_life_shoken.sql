-- 生活所見の記録(docs/features/life-shoken/)。既存テーブル・既存コードと両立する加算的な変更のみ。

-- 1. 生活メモ: 授業に紐づかない、日付ごとの生徒の様子の記録(1人1日1件)
create table life_memo (
  id uuid primary key default gen_random_uuid (),
  student_id uuid not null references student (id) on delete cascade,
  note_date date not null,
  content text not null,
  share_flag share_flag not null default 'shared',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, note_date)
);

alter table life_memo enable row level security;

grant select, insert, update, delete on life_memo to authenticated, service_role;

-- teacher_id を直接持たないため、student→class経由のサブクエリでポリシーを書く
create policy "teacher can manage own life memos" on life_memo
for all
  using (
    exists (
      select 1
      from student s
        join class c on c.id = s.class_id
      where
        s.id = life_memo.student_id
        and c.teacher_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1
      from student s
        join class c on c.id = s.class_id
      where
        s.id = life_memo.student_id
        and c.teacher_id = auth.uid ()
    )
  );

-- 2. 生活の所見: 学習の所見(student_comment)とは独立に、生徒ごとに最新1件のみ保持する。
--    student_commentに種別列を足して一意制約を(student_id, kind)に入れ替えると、
--    onConflict: "student_id" でupsertしている稼働中のコードが失敗するため別テーブルにする
create table student_life_comment (
  id uuid primary key default gen_random_uuid (),
  student_id uuid not null unique references student (id) on delete cascade,
  content text not null,
  target_char_count int,
  creation_method comment_creation_method not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table student_life_comment enable row level security;

grant select, insert, update, delete on student_life_comment to authenticated, service_role;

create policy "teacher can manage own student life comments" on student_life_comment
for all
  using (
    exists (
      select 1
      from student s
        join class c on c.id = s.class_id
      where
        s.id = student_life_comment.student_id
        and c.teacher_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1
      from student s
        join class c on c.id = s.class_id
      where
        s.id = student_life_comment.student_id
        and c.teacher_id = auth.uid ()
    )
  );

-- 3. 生活の所見用のプロンプトひな形。nullなら既定値を使う。
--    生活用だけを先に保存した教員の行を作れるよう、学習用(content)のnot nullも外す
--    (nullなら学習用の既定値を使う。既存コードも data?.content ?? 既定値 で読むため両立する)
alter table prompt_template add column life_content text;
alter table prompt_template alter column content drop not null;

-- 4. エクスポートに生活メモ・生活の所見・生活用ひな形を追加する(既存キーは変えない)
create or replace function export_teacher_data () returns jsonb language plpgsql as $$
declare
  v_teacher_id uuid := auth.uid();
  v_result jsonb;
begin
  select jsonb_build_object(
    'exportedAt', now(),
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'grade', c.grade,
        'groupNumber', c.group_number,
        'displayName', c.display_name,
        'createdAt', c.created_at
      ) order by c.grade, c.group_number)
      from class c where c.teacher_id = v_teacher_id
    ), '[]'::jsonb),
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sub.id,
        'name', sub.name,
        'createdAt', sub.created_at
      ) order by sub.created_at)
      from subject sub where sub.teacher_id = v_teacher_id
    ), '[]'::jsonb),
    'timetableMaster', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weekday', t.weekday,
        'period', t.period,
        'subjectId', t.subject_id,
        'classId', t.class_id
      ) order by t.weekday, t.period)
      from timetable_master_slot t where t.teacher_id = v_teacher_id
    ), '[]'::jsonb),
    'weeklySubjectOverrides', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weekStartDate', o.week_start_date,
        'weekday', o.weekday,
        'period', o.period,
        'subjectId', o.subject_id
      ) order by o.week_start_date, o.weekday, o.period)
      from weekly_subject_override o where o.teacher_id = v_teacher_id
    ), '[]'::jsonb),
    'weeklyClassOverrides', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weekStartDate', o.week_start_date,
        'weekday', o.weekday,
        'period', o.period,
        'classId', o.class_id
      ) order by o.week_start_date, o.weekday, o.period)
      from weekly_class_override o where o.teacher_id = v_teacher_id
    ), '[]'::jsonb),
    'promptTemplate', (
      select jsonb_build_object('content', p.content, 'lifeContent', p.life_content, 'updatedAt', p.updated_at)
      from prompt_template p where p.teacher_id = v_teacher_id
    ),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'classId', s.class_id,
        'attendanceNumber', s.attendance_number,
        'name', s.name,
        'memos', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', m.id,
            'subjectId', m.subject_id,
            'noteDate', m.note_date,
            'period', m.period,
            'content', m.content,
            'shareFlag', m.share_flag,
            'createdAt', m.created_at,
            'updatedAt', m.updated_at
          ) order by m.note_date, m.period)
          from memo m where m.student_id = s.id
        ), '[]'::jsonb),
        'comments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', sc.id,
            'content', sc.content,
            'targetCharCount', sc.target_char_count,
            'creationMethod', sc.creation_method,
            'createdAt', sc.created_at,
            'updatedAt', sc.updated_at
          ))
          from student_comment sc where sc.student_id = s.id
        ), '[]'::jsonb),
        'lifeMemos', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', lm.id,
            'noteDate', lm.note_date,
            'content', lm.content,
            'shareFlag', lm.share_flag,
            'createdAt', lm.created_at,
            'updatedAt', lm.updated_at
          ) order by lm.note_date)
          from life_memo lm where lm.student_id = s.id
        ), '[]'::jsonb),
        'lifeComments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', slc.id,
            'content', slc.content,
            'targetCharCount', slc.target_char_count,
            'creationMethod', slc.creation_method,
            'createdAt', slc.created_at,
            'updatedAt', slc.updated_at
          ))
          from student_life_comment slc where slc.student_id = s.id
        ), '[]'::jsonb)
      ) order by s.class_id, s.attendance_number)
      from student s join class c on c.id = s.class_id where c.teacher_id = v_teacher_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;
