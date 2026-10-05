-- 単元の記録と単元別の所見生成(docs/features/memo-unit/)。
-- 既存テーブルの列・制約・RLSポリシーには一切触れない加算的な変更のみのため、
-- 2フェーズ方式(expand/contract)は不要(docs/features/memo-unit/design.md §1)。

-- 1. 単元マスタ: 科目に属する単元の名前の一覧。教員が授業記録の前に登録しておく。
--    teacher_id は持たない。所有者は subject 経由で一意に決まるため列を複製せず、
--    クライアントから teacher_id を渡す実装を不要にする(CLAUDE.md の方針)。
--    単元名の重複は防がない(科目名の重複を許可している方針に揃える)。
--    unique (id, subject_id) は名前の重複防止ではなく、memo からの複合外部キー
--    (単元は必ずそのメモの科目に属する)の参照先として必要なもの
create table unit (
  id uuid primary key default gen_random_uuid (),
  subject_id uuid not null references subject (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, subject_id)
);

create index unit_subject_id_idx on unit (subject_id);

alter table unit enable row level security;

grant select, insert, update, delete on unit to authenticated, service_role;

-- teacher_id を直接持たないため、subject 経由のサブクエリでポリシーを書く
create policy "teacher can manage own units" on unit
for all
  using (
    exists (
      select 1
      from subject s
      where
        s.id = unit.subject_id
        and s.teacher_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1
      from subject s
      where
        s.id = unit.subject_id
        and s.teacher_id = auth.uid ()
    )
  );

-- 2. 授業メモへの単元の記録。既存のメモはすべて null(単元未設定)になるため移行は不要。
--    単元の選択は任意なので、今後も null の行は発生しうる
alter table memo add column unit_id uuid;

-- 複合外部キーにすることで「算数のメモに国語の単元が入る」組み合わせをDB側で止める
-- (ビジネスルールの最終防衛線はDB側、というCLAUDE.mdの方針)。
-- on delete set null の列リストは省略できない: 複数列の外部キーでは既定で参照元の全列が
-- null になるため、not null である memo.subject_id を巻き込んで単元削除が必ず失敗する。
-- 列リスト付きの set null はPostgres 15以降で使える(ローカルは major_version = 17)
alter table memo
  add constraint memo_unit_fk
  foreign key (unit_id, subject_id) references unit (id, subject_id)
  on delete set null (unit_id);

-- 3. 単元名を編集したときに updated_at が進むようにする(既存7テーブルと同じ関数を再利用)
create trigger unit_set_updated_at before update on unit
for each row
execute function set_updated_at ();

-- 4. エクスポートに科目ごとの単元一覧とメモの単元を追加する(既存キーは変えない)
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
        'createdAt', sub.created_at,
        'units', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', u.id,
            'name', u.name,
            'createdAt', u.created_at
          ) order by u.created_at)
          from unit u where u.subject_id = sub.id
        ), '[]'::jsonb)
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
      select jsonb_build_object(
        'content', p.content,
        'lifeContent', p.life_content,
        'generalContent', p.general_content,
        'updatedAt', p.updated_at
      )
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
            'unitId', m.unit_id,
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
        ), '[]'::jsonb),
        'generalComments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', sgc.id,
            'content', sgc.content,
            'targetCharCount', sgc.target_char_count,
            'creationMethod', sgc.creation_method,
            'createdAt', sgc.created_at,
            'updatedAt', sgc.updated_at
          ))
          from student_general_comment sgc where sgc.student_id = s.id
        ), '[]'::jsonb)
      ) order by s.class_id, s.attendance_number)
      from student s join class c on c.id = s.class_id where c.teacher_id = v_teacher_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;
