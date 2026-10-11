-- 「単元ごとに生成」専用のプロンプトひな形(docs/features/memo-unit/ UN-028)。
-- 既存の列・制約には触れない加算的な変更のみ。
--
-- 20261005090000_memo_unit.sql はローカルで適用済み(履歴にも載っている)ため書き換えず、
-- 別ファイルとして追加する。
--
-- 注意: 新コードは prompt_template から unit_content / general_unit_content を select する。
-- このマイグレーションを適用する前に新コードをデプロイすると、ひな形の取得自体が失敗し、
-- プロンプトひな形編集画面とAI生成セクションが開けなくなる(適用を先に行う)。

-- 1. 学習・総合の「単元ごと」用ひな形。nullなら本ツール既定の初期値を使う
--    (既存の content / life_content / general_content と同じ扱い)。
--    生活の所見は単元を持たないため列を追加しない
alter table prompt_template add column unit_content text;
alter table prompt_template add column general_unit_content text;

-- 2. エクスポートに2つのひな形を追加する(既存キーは変えない)
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
        'unitContent', p.unit_content,
        'generalUnitContent', p.general_unit_content,
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
