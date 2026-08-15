-- クラス作成: 組番号発行+クラス作成を1トランザクションで
create function create_class (p_grade text, p_display_name text) returns class language plpgsql as $$
declare
  v_teacher_id uuid := auth.uid();
  v_group_number int;
  v_class class;
begin
  insert into class_number_counter (teacher_id, grade_group, last_issued_number)
  values (v_teacher_id, p_grade, 1)
  on conflict (teacher_id, grade_group)
  do update set last_issued_number = class_number_counter.last_issued_number + 1
  returning last_issued_number into v_group_number;

  insert into class (teacher_id, grade, group_number, display_name)
  values (v_teacher_id, p_grade, v_group_number, p_display_name)
  returning * into v_class;

  return v_class;
end;
$$;

-- クラスの学年変更: 新学年区分内で未使用の組番号に再採番
create function update_class_grade (p_class_id uuid, p_new_grade text) returns class language plpgsql as $$
declare
  v_teacher_id uuid := auth.uid();
  v_group_number int;
  v_class class;
begin
  insert into class_number_counter (teacher_id, grade_group, last_issued_number)
  values (v_teacher_id, p_new_grade, 1)
  on conflict (teacher_id, grade_group)
  do update set last_issued_number = class_number_counter.last_issued_number + 1
  returning last_issued_number into v_group_number;

  update class
  set grade = p_new_grade, group_number = v_group_number
  where id = p_class_id and teacher_id = v_teacher_id
  returning * into v_class;

  if v_class is null then
    raise exception 'NOT_FOUND: クラスが見つかりません';
  end if;

  return v_class;
end;
$$;

-- クラス削除: 生徒0人チェック→時間割参照のクリーンアップ→削除、を1トランザクションで
create function delete_class (p_class_id uuid) returns void language plpgsql as $$
declare
  v_teacher_id uuid := auth.uid();
  v_student_count int;
begin
  select count(*) into v_student_count from student where class_id = p_class_id;
  if v_student_count > 0 then
    raise exception 'STUDENTS_EXIST: 生徒が登録されているため削除できません。先に生徒名簿から生徒を削除してください';
  end if;

  update timetable_master_slot set class_id = null
    where class_id = p_class_id and teacher_id = v_teacher_id;
  delete from weekly_class_override
    where class_id = p_class_id and teacher_id = v_teacher_id;
  delete from class
    where id = p_class_id and teacher_id = v_teacher_id;
end;
$$;
