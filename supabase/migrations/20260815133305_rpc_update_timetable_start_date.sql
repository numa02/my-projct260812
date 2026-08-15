-- 起算日の変更: 通常保存(メモが1件でもあれば拒否) と 年度更新(強制)を1関数に集約
create function update_timetable_start_date (p_new_start_date date, p_force boolean default false) returns teacher_profile language plpgsql as $$
declare
  v_teacher_id uuid := auth.uid();
  v_memo_count int;
  v_profile teacher_profile;
begin
  if not p_force then
    select count(*) into v_memo_count
    from memo m join student s on s.id = m.student_id join class c on c.id = s.class_id
    where c.teacher_id = v_teacher_id;

    if v_memo_count > 0 then
      raise exception 'START_DATE_LOCKED: 授業記録が開始されているため起算日は変更できません';
    end if;
  end if;

  update teacher_profile set start_date = p_new_start_date
    where id = v_teacher_id
    returning * into v_profile;

  return v_profile;
end;
$$;
