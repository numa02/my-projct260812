import { afterEach, describe, expect, it } from "vitest";
import { createTestTeacher, deleteTestTeacher, type TestTeacher } from "./helpers";

describe("delete_subject", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("メモで使用中の科目削除はSUBJECT_IN_USEエラーになる(T-017)", async () => {
    teacher = await createTestTeacher();

    const { data: subject } = await teacher.client
      .from("subject")
      .insert({ teacher_id: teacher.id, name: "国語" })
      .select()
      .single<{ id: string }>();
    const { data: klass } = await teacher.client
      .rpc("create_class", { p_grade: "1", p_display_name: "1年1組" })
      .single<{ id: string }>();
    const { data: student } = await teacher.client
      .from("student")
      .insert({ class_id: klass!.id, attendance_number: 1, name: "生徒A" })
      .select()
      .single<{ id: string }>();
    await teacher.client.from("memo").insert({
      student_id: student!.id,
      subject_id: subject!.id,
      note_date: "2026-04-10",
      period: 1,
      content: "メモ",
    });

    const { error } = await teacher.client.rpc("delete_subject", { p_subject_id: subject!.id });
    expect(error?.message).toContain("SUBJECT_IN_USE");

    const { data: stillExists } = await teacher.client
      .from("subject")
      .select("id")
      .eq("id", subject!.id);
    expect(stillExists).toHaveLength(1);
  });

  it("時間割マスタでのみ使用中の科目は削除後にマスタが未設定へ戻る(T-017)", async () => {
    teacher = await createTestTeacher();

    const { data: subject } = await teacher.client
      .from("subject")
      .insert({ teacher_id: teacher.id, name: "算数" })
      .select()
      .single<{ id: string }>();
    await teacher.client
      .from("timetable_master_slot")
      .insert({ teacher_id: teacher.id, weekday: 2, period: 3, subject_id: subject!.id });

    const { error } = await teacher.client.rpc("delete_subject", { p_subject_id: subject!.id });
    expect(error).toBeNull();

    const { data: deletedSubject } = await teacher.client
      .from("subject")
      .select("id")
      .eq("id", subject!.id);
    expect(deletedSubject).toHaveLength(0);

    const { data: slot } = await teacher.client
      .from("timetable_master_slot")
      .select("subject_id")
      .eq("teacher_id", teacher.id)
      .eq("weekday", 2)
      .eq("period", 3)
      .single();
    expect(slot?.subject_id).toBeNull();
  });
});
