-- 標準科目セット投入: 小学校/中学校の固定リストを、既存と重複しない科目名だけ一括登録する。
-- subject.nameにユニーク制約がない(重複許可の既存方針)ため、READ COMMITTED下での
-- 「存在確認→insert」だけでは同一teacher_idからの並行呼び出しで二重登録が起きうる。
-- pg_advisory_xact_lockでteacher_id単位に直列化し、トランザクション終了時に自動解放させる
create function seed_standard_subjects (p_school_level text) returns jsonb
language plpgsql as $$
declare
  v_teacher_id uuid := auth.uid();
  v_names text[];
  v_inserted text[] := '{}';
  v_name text;
begin
  perform pg_advisory_xact_lock(hashtext(v_teacher_id::text));

  if p_school_level = 'elementary' then
    v_names := array['国語', '算数', '理科', '社会', '英語', '図画工作', '体育', '音楽', '総合', '学活'];
  elsif p_school_level = 'middle' then
    v_names := array['国語', '数学', '理科', '社会', '英語', '美術', '技術・家庭', '保健体育', '音楽', '総合', '学活'];
  else
    raise exception 'INVALID_SCHOOL_LEVEL: 学校区分の指定が不正です';
  end if;

  foreach v_name in array v_names loop
    if not exists (
      select 1 from subject where teacher_id = v_teacher_id and name = v_name
    ) then
      insert into subject (teacher_id, name) values (v_teacher_id, v_name);
      v_inserted := array_append(v_inserted, v_name);
    end if;
  end loop;

  return jsonb_build_object('inserted', to_jsonb(v_inserted));
end;
$$;
