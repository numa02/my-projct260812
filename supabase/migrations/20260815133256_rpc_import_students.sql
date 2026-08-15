-- CSV/貼り付け一括登録: 行ごとの部分成功を返す(F2の仕様通り、全体をロールバックしない)
-- p_rows: [{ "attendanceNumber": number, "name": string }, ...]
create function import_students (p_class_id uuid, p_rows jsonb) returns jsonb language plpgsql as $$
declare
  v_teacher_id uuid := auth.uid();
  v_row jsonb;
  v_index int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_imported jsonb := '[]'::jsonb;
  v_attendance_number int;
  v_name text;
  v_seen_numbers int[] := '{}';
  v_existing_count int;
begin
  -- p_class_id が呼び出し教員のものであることを確認
  perform 1 from class where id = p_class_id and teacher_id = v_teacher_id;
  if not found then
    raise exception 'NOT_FOUND: クラスが見つかりません';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;
    v_name := nullif(trim(both from coalesce(v_row->>'name', '')), '');

    begin
      v_attendance_number := (v_row->>'attendanceNumber')::int;
    exception when others then
      v_attendance_number := null;
    end;

    if v_name is null or v_attendance_number is null then
      v_errors := v_errors || jsonb_build_object(
        'rowIndex', v_index,
        'reason', 'MISSING_FIELD',
        'attendanceNumber', v_row->>'attendanceNumber',
        'name', v_row->>'name'
      );
      continue;
    end if;

    if v_attendance_number = any (v_seen_numbers) then
      v_errors := v_errors || jsonb_build_object(
        'rowIndex', v_index,
        'reason', 'DUPLICATE_IN_BATCH',
        'attendanceNumber', v_attendance_number,
        'name', v_name
      );
      continue;
    end if;

    select count(*) into v_existing_count
    from student
    where class_id = p_class_id and attendance_number = v_attendance_number;

    if v_existing_count > 0 then
      v_errors := v_errors || jsonb_build_object(
        'rowIndex', v_index,
        'reason', 'DUPLICATE_EXISTING',
        'attendanceNumber', v_attendance_number,
        'name', v_name
      );
      continue;
    end if;

    v_seen_numbers := array_append(v_seen_numbers, v_attendance_number);

    insert into student (class_id, attendance_number, name)
    values (p_class_id, v_attendance_number, v_name);

    v_imported := v_imported || jsonb_build_object(
      'rowIndex', v_index,
      'attendanceNumber', v_attendance_number,
      'name', v_name
    );
  end loop;

  return jsonb_build_object('imported', v_imported, 'errors', v_errors);
end;
$$;
