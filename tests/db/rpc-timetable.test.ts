import { afterEach, describe, expect, it } from "vitest";
import { createTestTeacher, deleteTestTeacher, type TestTeacher } from "./helpers";

async function setupClassesAndSubject(teacher: TestTeacher) {
  const { data: classA } = await teacher.client
    .rpc("create_class", { p_grade: "1", p_display_name: "1年1組" })
    .single<{ id: string }>();
  const { data: classB } = await teacher.client
    .rpc("create_class", { p_grade: "1", p_display_name: "1年2組" })
    .single<{ id: string }>();
  const { data: subject } = await teacher.client
    .from("subject")
    .insert({ teacher_id: teacher.id, name: "国語" })
    .select()
    .single<{ id: string }>();
  return { classAId: classA!.id, classBId: classB!.id, subjectId: subject!.id };
}

describe("save_timetable_master", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("保存後のマスタ内容と一致した個別変更だけがマスタ追従に戻る(T-019)", async () => {
    teacher = await createTestTeacher();
    const { classAId, classBId, subjectId } = await setupClassesAndSubject(teacher);

    // 初回マスタ保存
    const { error: firstSaveError } = await teacher.client.rpc("save_timetable_master", {
      p_slots: [{ weekday: 1, period: 1, subjectId, classId: classAId }],
    });
    expect(firstSaveError).toBeNull();

    // 個別変更: 科目のみ変更(nullに)、クラスのみ変更(classBに)
    await teacher.client.from("weekly_subject_override").insert({
      teacher_id: teacher.id,
      week_start_date: "2026-04-06",
      weekday: 1,
      period: 1,
      subject_id: null,
    });
    await teacher.client.from("weekly_class_override").insert({
      teacher_id: teacher.id,
      week_start_date: "2026-04-06",
      weekday: 1,
      period: 1,
      class_id: classBId,
    });

    // マスタを「科目未設定・クラスB」に変更して保存 → 両方の個別変更がマスタ内容と一致するため削除される
    const { error: secondSaveError } = await teacher.client.rpc("save_timetable_master", {
      p_slots: [{ weekday: 1, period: 1, subjectId: null, classId: classBId }],
    });
    expect(secondSaveError).toBeNull();

    const { data: subjectOverrides } = await teacher.client
      .from("weekly_subject_override")
      .select("id")
      .eq("teacher_id", teacher.id);
    expect(subjectOverrides).toHaveLength(0);

    const { data: classOverrides } = await teacher.client
      .from("weekly_class_override")
      .select("id")
      .eq("teacher_id", teacher.id);
    expect(classOverrides).toHaveLength(0);

    const { data: slot } = await teacher.client
      .from("timetable_master_slot")
      .select("subject_id, class_id")
      .eq("teacher_id", teacher.id)
      .eq("weekday", 1)
      .eq("period", 1)
      .single();
    expect(slot?.subject_id).toBeNull();
    expect(slot?.class_id).toBe(classBId);
  });

  it("一括モードでの上書きは未確認だとCONFIRM_OVERWRITEエラーになり、確認後は成功する(T-019)", async () => {
    teacher = await createTestTeacher();
    const { classAId, classBId, subjectId } = await setupClassesAndSubject(teacher);

    // 教科担任制モード相当: マスごとに異なるクラス
    await teacher.client.rpc("save_timetable_master", {
      p_slots: [
        { weekday: 1, period: 1, subjectId, classId: classAId },
        { weekday: 1, period: 2, subjectId, classId: classBId },
      ],
    });

    // 一括モードでclassAに統一しようとする(未確認)
    const { error: unconfirmedError } = await teacher.client.rpc("save_timetable_master", {
      p_slots: [
        { weekday: 1, period: 1, subjectId, classId: classAId },
        { weekday: 1, period: 2, subjectId, classId: classAId },
      ],
      p_confirm_overwrite: false,
    });
    expect(unconfirmedError?.message).toContain("CONFIRM_OVERWRITE");

    // マスタは変更されていない
    const { data: untouchedSlot } = await teacher.client
      .from("timetable_master_slot")
      .select("class_id")
      .eq("teacher_id", teacher.id)
      .eq("weekday", 1)
      .eq("period", 2)
      .single();
    expect(untouchedSlot?.class_id).toBe(classBId);

    // 確認済みで再実行すると成功する
    const { error: confirmedError } = await teacher.client.rpc("save_timetable_master", {
      p_slots: [
        { weekday: 1, period: 1, subjectId, classId: classAId },
        { weekday: 1, period: 2, subjectId, classId: classAId },
      ],
      p_confirm_overwrite: true,
    });
    expect(confirmedError).toBeNull();

    const { data: updatedSlot } = await teacher.client
      .from("timetable_master_slot")
      .select("class_id")
      .eq("teacher_id", teacher.id)
      .eq("weekday", 1)
      .eq("period", 2)
      .single();
    expect(updatedSlot?.class_id).toBe(classAId);
  });

  it("既存の全マスのクラスが既に一致している場合は確認なしで保存できる(T-019)", async () => {
    teacher = await createTestTeacher();
    const { classAId, subjectId } = await setupClassesAndSubject(teacher);

    await teacher.client.rpc("save_timetable_master", {
      p_slots: [
        { weekday: 1, period: 1, subjectId, classId: classAId },
        { weekday: 1, period: 2, subjectId, classId: classAId },
      ],
    });

    const { error } = await teacher.client.rpc("save_timetable_master", {
      p_slots: [
        { weekday: 1, period: 1, subjectId, classId: classAId },
        { weekday: 1, period: 2, subjectId, classId: classAId },
      ],
      p_confirm_overwrite: false,
    });
    expect(error).toBeNull();
  });
});

describe("update_timetable_start_date", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("メモが1件以上あるとforce=falseでは拒否され、force=trueでは更新できる(T-020)", async () => {
    teacher = await createTestTeacher();
    const { classAId, subjectId } = await setupClassesAndSubject(teacher);
    const { data: student } = await teacher.client
      .from("student")
      .insert({ class_id: classAId, attendance_number: 1, name: "生徒A" })
      .select()
      .single<{ id: string }>();
    await teacher.client.from("memo").insert({
      student_id: student!.id,
      subject_id: subjectId,
      note_date: "2026-04-10",
      period: 1,
      content: "メモ",
    });

    const { error: rejectedError } = await teacher.client.rpc("update_timetable_start_date", {
      p_new_start_date: "2026-04-01",
      p_force: false,
    });
    expect(rejectedError?.message).toContain("START_DATE_LOCKED");

    const { data: forced, error: forcedError } = await teacher.client
      .rpc("update_timetable_start_date", { p_new_start_date: "2026-04-01", p_force: true })
      .single<{ start_date: string }>();
    expect(forcedError).toBeNull();
    expect(forced?.start_date).toBe("2026-04-01");
  });

  it("メモが0件ならforce=falseでも更新できる(T-020)", async () => {
    teacher = await createTestTeacher();

    const { data, error } = await teacher.client
      .rpc("update_timetable_start_date", { p_new_start_date: "2026-04-06", p_force: false })
      .single<{ start_date: string }>();

    expect(error).toBeNull();
    expect(data?.start_date).toBe("2026-04-06");
  });
});
