-- フェーズ2(縮小・破壊的): student_comment.period_start_date / period_end_date を削除する。
-- CM-013(フェーズ1)の本番安定稼働を確認してから適用すること(docs/features/comments/design.md参照)。

-- 0. export_teacher_data() は削除対象の2列を直接参照しているため、列を削除する前に
--    参照を除去した定義へ置き換える(同一トランザクション内で行うことで、
--    「関数は新定義だが列がまだ残っている/列は消えたが関数は旧定義のまま」という
--    不整合な中間状態が生じないようにする)。所感は生徒ごとに最大1件のため、
--    出力形式(配列)自体は変えず、periodStartDate/periodEndDateのキーのみ削除する。
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
      select jsonb_build_object('content', p.content, 'updatedAt', p.updated_at)
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
        ), '[]'::jsonb)
      ) order by s.class_id, s.attendance_number)
      from student s join class c on c.id = s.class_id where c.teacher_id = v_teacher_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- 1. 旧複合ユニーク制約は無名(create table内でのunique指定)で作成されているため、
--    Postgresが自動生成した実際の制約名は63バイトの識別子上限で切り詰められており、
--    元のDDLから単純に組み立てた名前とは一致しない。決め打ちで名前を書いてdropするのは危険なため、
--    pg_constraintから対象列の集合で動的に検索して削除する
do $$
declare
  v_constraint_name text;
begin
  select con.conname into v_constraint_name
  from pg_constraint con
  where con.conrelid = 'public.student_comment'::regclass
    and con.contype = 'u'
    and (
      select array_agg(a.attname::text order by a.attname)
      from unnest(con.conkey) k
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k
    ) = array['period_end_date', 'period_start_date', 'student_id'];

  if v_constraint_name is not null then
    execute format('alter table student_comment drop constraint %I', v_constraint_name);
  else
    raise notice 'old composite unique constraint not found (already dropped?)';
  end if;
end $$;

-- 2. period_start_date / period_end_date を削除する。この時点以降、コードロールバックだけでは
--    復旧できない(docs/features/comments/design.md「ロールバック手順」参照)
alter table student_comment drop column period_start_date;
alter table student_comment drop column period_end_date;
