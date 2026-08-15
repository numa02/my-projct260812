-- 科目削除: メモで使用中なら拒否、時間割のみ使用中ならset nullされた上で削除
create function delete_subject (p_subject_id uuid) returns void language plpgsql as $$
declare
  v_teacher_id uuid := auth.uid();
  v_memo_count int;
begin
  select count(*) into v_memo_count
  from memo m join student s on s.id = m.student_id join class c on c.id = s.class_id
  where m.subject_id = p_subject_id and c.teacher_id = v_teacher_id;

  if v_memo_count > 0 then
    raise exception 'SUBJECT_IN_USE: この科目は時間割またはメモで使用されているため削除できません';
  end if;

  delete from subject where id = p_subject_id and teacher_id = v_teacher_id;
  -- timetable_master_slot / weekly_subject_override の subject_id は on delete set null で自動的に未設定へ
end;
$$;
