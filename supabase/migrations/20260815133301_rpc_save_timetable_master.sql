-- 時間割マスタ保存: 全スロット upsert + 既存の週次個別変更のうち
-- 新しいマスタ内容と一致した項目だけをマスタ追従に戻す(F4の巻き戻しロジック)
-- p_slots: [{ "weekday": number, "period": number, "subjectId": uuid|null, "classId": uuid|null }, ...]
--
-- 一括モードでの上書き確認(F4):p_slotsの全スロットが単一のクラスに統一されており、
-- かつ既存マスタにそれと異なるクラスが割り当てられているスロットが1件以上ある場合、
-- p_confirm_overwrite=false なら例外を投げてフロントに確認ダイアログを出させる。
-- 既存の全マスのクラスが既にそのクラスと一致している場合は上書きが実質的に発生しないため対象外。
create function save_timetable_master (p_slots jsonb, p_confirm_overwrite boolean default false) returns jsonb language plpgsql as $$
declare
  v_teacher_id uuid := auth.uid();
  v_slot jsonb;
  v_weekday int;
  v_period int;
  v_subject_id uuid;
  v_class_id uuid;
  v_class_slot_count int;
  v_distinct_class_count int;
  v_uniform_class_id uuid;
  v_conflicting_count int;
  v_class_display_name text;
begin
  select count(*), count(distinct (s ->> 'classId')::uuid), (array_agg((s ->> 'classId')::uuid)) [1] into v_class_slot_count, v_distinct_class_count, v_uniform_class_id
  from jsonb_array_elements(p_slots) s
  where s ->> 'classId' is not null;

  -- 複数スロットを同一クラスへ一括統一しようとしている場合のみ「一括モードでの上書き」とみなす。
  -- 1スロットだけの部分更新(教科担任制モードでの単発編集等)は対象外
  if v_distinct_class_count = 1 and v_class_slot_count > 1 then
    select count(*) into v_conflicting_count
    from timetable_master_slot
    where
      teacher_id = v_teacher_id
      and class_id is not null
      and class_id <> v_uniform_class_id;

    if v_conflicting_count > 0 and not p_confirm_overwrite then
      select display_name into v_class_display_name from class where id = v_uniform_class_id;
      raise exception 'CONFIRM_OVERWRITE: 保存すると、マスごとに設定されているクラスがすべて「%」に統一されます。続行しますか', v_class_display_name;
    end if;
  end if;

  for v_slot in select * from jsonb_array_elements(p_slots) loop
    v_weekday := (v_slot ->> 'weekday')::int;
    v_period := (v_slot ->> 'period')::int;
    v_subject_id := nullif(v_slot ->> 'subjectId', '')::uuid;
    v_class_id := nullif(v_slot ->> 'classId', '')::uuid;

    insert into timetable_master_slot (teacher_id, weekday, period, subject_id, class_id)
    values (v_teacher_id, v_weekday, v_period, v_subject_id, v_class_id)
    on conflict (teacher_id, weekday, period)
    do update set subject_id = excluded.subject_id, class_id = excluded.class_id;

    -- 巻き戻し: 保存後のマスタ内容と一致した個別変更を、科目・クラスそれぞれ独立に判定して削除
    delete from weekly_subject_override
    where
      teacher_id = v_teacher_id
      and weekday = v_weekday
      and period = v_period
      and subject_id is not distinct from v_subject_id;

    delete from weekly_class_override
    where
      teacher_id = v_teacher_id
      and weekday = v_weekday
      and period = v_period
      and class_id is not distinct from v_class_id;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;
