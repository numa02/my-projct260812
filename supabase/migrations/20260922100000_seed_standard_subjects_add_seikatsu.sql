-- 小学校の標準科目セットに教科「生活」(小学校1・2年)を追加する。
-- 関数の再定義のみで、既存の科目レコード・他のテーブルには一切触れない加算的な変更。
-- 既に標準セットを投入済みの教員が再実行した場合は、重複しない「生活」だけが追加される。
create or replace function seed_standard_subjects (p_school_level text) returns jsonb
language plpgsql as $$
declare
  v_teacher_id uuid := auth.uid();
  v_names text[];
  v_inserted text[] := '{}';
  v_name text;
begin
  perform pg_advisory_xact_lock(hashtext(v_teacher_id::text));

  if p_school_level = 'elementary' then
    v_names := array['国語', '算数', '理科', '社会', '英語', '図画工作', '体育', '音楽', '生活', '総合', '学活'];
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
