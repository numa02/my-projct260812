import { afterEach, describe, expect, it } from "vitest";
import { createTestTeacher, deleteTestTeacher, type TestTeacher } from "./helpers";

describe("create_class / update_class_grade / delete_class", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("組番号が学年区分内で連番採番される(T-016)", async () => {
    teacher = await createTestTeacher();

    const { data: first } = await teacher.client
      .rpc("create_class", { p_grade: "1", p_display_name: "1年1組" })
      .single<{ group_number: number }>();
    const { data: second } = await teacher.client
      .rpc("create_class", { p_grade: "1", p_display_name: "1年2組" })
      .single<{ group_number: number }>();
    const { data: otherGrade } = await teacher.client
      .rpc("create_class", { p_grade: "2", p_display_name: "2年1組" })
      .single<{ group_number: number }>();
    const { data: tokushi } = await teacher.client
      .rpc("create_class", { p_grade: "特支", p_display_name: "ひまわり組" })
      .single<{ group_number: number }>();

    expect(first?.group_number).toBe(1);
    expect(second?.group_number).toBe(2);
    expect(otherGrade?.group_number).toBe(1); // 学年区分が異なれば別カウント
    expect(tokushi?.group_number).toBe(1); // 特支は独立した学年区分として採番
  });

  it("学年変更時に新学年区分内で未使用の組番号に再採番される(T-016)", async () => {
    teacher = await createTestTeacher();

    await teacher.client.rpc("create_class", { p_grade: "2", p_display_name: "2年1組" });
    const { data: target } = await teacher.client
      .rpc("create_class", { p_grade: "1", p_display_name: "1年1組" })
      .single<{ id: string; group_number: number }>();
    expect(target?.group_number).toBe(1);

    const { data: updated, error } = await teacher.client
      .rpc("update_class_grade", { p_class_id: target!.id, p_new_grade: "2" })
      .single<{ grade: string; group_number: number }>();

    expect(error).toBeNull();
    expect(updated?.grade).toBe("2");
    expect(updated?.group_number).toBe(2); // 学年2区分では既に1が使用済みのため2番
  });

  it("存在しないクラスの学年変更はNOT_FOUNDエラーになる(T-016)", async () => {
    teacher = await createTestTeacher();

    const { error } = await teacher.client.rpc("update_class_grade", {
      p_class_id: "00000000-0000-0000-0000-000000000000",
      p_new_grade: "3",
    });

    expect(error?.message).toContain("NOT_FOUND");
  });

  it("生徒が登録されているクラスの削除は拒否される(T-016)", async () => {
    teacher = await createTestTeacher();

    const { data: klass } = await teacher.client
      .rpc("create_class", { p_grade: "1", p_display_name: "1年1組" })
      .single<{ id: string }>();
    await teacher.client
      .from("student")
      .insert({ class_id: klass!.id, attendance_number: 1, name: "生徒A" });

    const { error } = await teacher.client.rpc("delete_class", { p_class_id: klass!.id });

    expect(error?.message).toContain("STUDENTS_EXIST");
  });

  it("生徒0人のクラス削除で時間割参照がクリーンアップされてから削除される(T-016)", async () => {
    teacher = await createTestTeacher();

    const { data: klass } = await teacher.client
      .rpc("create_class", { p_grade: "1", p_display_name: "1年1組" })
      .single<{ id: string }>();

    await teacher.client
      .from("timetable_master_slot")
      .insert({ teacher_id: teacher.id, weekday: 1, period: 1, class_id: klass!.id });
    await teacher.client
      .from("weekly_class_override")
      .insert({
        teacher_id: teacher.id,
        week_start_date: "2026-04-06",
        weekday: 1,
        period: 1,
        class_id: klass!.id,
      });

    const { error } = await teacher.client.rpc("delete_class", { p_class_id: klass!.id });
    expect(error).toBeNull();

    const { data: remainingClass } = await teacher.client
      .from("class")
      .select("id")
      .eq("id", klass!.id);
    expect(remainingClass).toHaveLength(0);

    const { data: slot } = await teacher.client
      .from("timetable_master_slot")
      .select("class_id")
      .eq("teacher_id", teacher.id)
      .eq("weekday", 1)
      .eq("period", 1)
      .single();
    expect(slot?.class_id).toBeNull();

    const { data: overrides } = await teacher.client
      .from("weekly_class_override")
      .select("id")
      .eq("class_id", klass!.id);
    expect(overrides).toHaveLength(0);
  });
});
