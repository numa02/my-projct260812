import { afterEach, describe, expect, it } from "vitest";
import { adminClient, createTestTeacher, deleteTestTeacher, type TestTeacher } from "./helpers";

describe("teacher_profile", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("サインアップ直後にteacher_profile行が自動作成される(T-007)", async () => {
    teacher = await createTestTeacher();

    const { data, error } = await teacher.client
      .from("teacher_profile")
      .select("id, start_date")
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBe(teacher.id);
    expect(data?.start_date).toBeNull();
  });
});

describe("subject", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("科目名の重複が許可される(T-010)", async () => {
    teacher = await createTestTeacher();

    const { error: firstError } = await teacher.client
      .from("subject")
      .insert({ teacher_id: teacher.id, name: "国語" });
    const { error: secondError } = await teacher.client
      .from("subject")
      .insert({ teacher_id: teacher.id, name: "国語" });

    expect(firstError).toBeNull();
    expect(secondError).toBeNull();

    const { data } = await teacher.client.from("subject").select("id").eq("name", "国語");
    expect(data).toHaveLength(2);
  });
});

describe("timetable_master_slot", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("(teacher_id, weekday, period)のユニーク制約が機能する(T-011)", async () => {
    teacher = await createTestTeacher();

    const { error: firstError } = await teacher.client
      .from("timetable_master_slot")
      .insert({ teacher_id: teacher.id, weekday: 1, period: 1 });
    expect(firstError).toBeNull();

    const { error: secondError } = await teacher.client
      .from("timetable_master_slot")
      .insert({ teacher_id: teacher.id, weekday: 1, period: 1 });
    expect(secondError).not.toBeNull();
  });
});

describe("weekly overrides", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("同一マス・同一週での重複が制約で防がれる(T-012)", async () => {
    teacher = await createTestTeacher();
    const weekStartDate = "2026-04-06";

    const { error: firstSubjectError } = await teacher.client
      .from("weekly_subject_override")
      .insert({ teacher_id: teacher.id, week_start_date: weekStartDate, weekday: 1, period: 1 });
    expect(firstSubjectError).toBeNull();

    const { error: secondSubjectError } = await teacher.client
      .from("weekly_subject_override")
      .insert({ teacher_id: teacher.id, week_start_date: weekStartDate, weekday: 1, period: 1 });
    expect(secondSubjectError).not.toBeNull();

    const { data: klass } = await teacher.client
      .rpc("create_class", { p_grade: "1", p_display_name: "1組" })
      .single();

    const { error: firstClassError } = await teacher.client
      .from("weekly_class_override")
      .insert({
        teacher_id: teacher.id,
        week_start_date: weekStartDate,
        weekday: 1,
        period: 1,
        class_id: (klass as { id: string }).id,
      });
    expect(firstClassError).toBeNull();

    const { error: secondClassError } = await teacher.client
      .from("weekly_class_override")
      .insert({
        teacher_id: teacher.id,
        week_start_date: weekStartDate,
        weekday: 1,
        period: 1,
        class_id: (klass as { id: string }).id,
      });
    expect(secondClassError).not.toBeNull();
  });
});

async function createClassWithStudent(teacher: TestTeacher) {
  const { data: klass } = await teacher.client
    .rpc("create_class", { p_grade: "1", p_display_name: "1組" })
    .single<{ id: string }>();
  const { data: student } = await teacher.client
    .from("student")
    .insert({ class_id: klass!.id, attendance_number: 1, name: "生徒A" })
    .select()
    .single<{ id: string }>();
  const { data: subject } = await teacher.client
    .from("subject")
    .insert({ teacher_id: teacher.id, name: "国語" })
    .select()
    .single<{ id: string }>();
  return { classId: klass!.id, studentId: student!.id, subjectId: subject!.id };
}

describe("memo", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("(student_id, subject_id, note_date, period)のユニーク制約でupsertが機能する(T-013)", async () => {
    teacher = await createTestTeacher();
    const { studentId, subjectId } = await createClassWithStudent(teacher);

    const memoInput = {
      student_id: studentId,
      subject_id: subjectId,
      note_date: "2026-04-10",
      period: 1,
      content: "最初のメモ",
    };

    const { error: insertError } = await teacher.client
      .from("memo")
      .upsert(memoInput, { onConflict: "student_id,subject_id,note_date,period" });
    expect(insertError).toBeNull();

    const { data: upserted, error: upsertError } = await teacher.client
      .from("memo")
      .upsert(
        { ...memoInput, content: "更新後のメモ" },
        { onConflict: "student_id,subject_id,note_date,period" },
      )
      .select();
    expect(upsertError).toBeNull();
    expect(upserted).toHaveLength(1);
    expect(upserted?.[0].content).toBe("更新後のメモ");

    const { data: all } = await teacher.client
      .from("memo")
      .select("id")
      .eq("student_id", studentId);
    expect(all).toHaveLength(1);
  });
});

describe("student_comment", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("(student_id, period_start_date, period_end_date)のユニーク制約でupsertが機能する(T-014)", async () => {
    teacher = await createTestTeacher();
    const { studentId } = await createClassWithStudent(teacher);

    const commentInput = {
      student_id: studentId,
      period_start_date: "2026-04-01",
      period_end_date: "2026-07-20",
      content: "最初の所感",
      creation_method: "manual" as const,
    };

    const { error: insertError } = await teacher.client
      .from("student_comment")
      .upsert(commentInput, { onConflict: "student_id,period_start_date,period_end_date" });
    expect(insertError).toBeNull();

    const { data: upserted, error: upsertError } = await teacher.client
      .from("student_comment")
      .upsert(
        { ...commentInput, content: "更新後の所感" },
        { onConflict: "student_id,period_start_date,period_end_date" },
      )
      .select();
    expect(upsertError).toBeNull();
    expect(upserted).toHaveLength(1);
    expect(upserted?.[0].content).toBe("更新後の所感");
  });
});

describe("ai_provider_setting", () => {
  it("APIキーが平文で保存されないカラム構成になっている(T-015)", async () => {
    const { error: encryptedColumnError } = await adminClient
      .from("ai_provider_setting")
      .select("encrypted_api_key")
      .limit(1);
    expect(encryptedColumnError).toBeNull();

    const { error: plaintextColumnError } = await adminClient
      .from("ai_provider_setting")
      // 平文カラムが存在しないことの確認。存在すればPostgRESTがカラム不在エラーを返さず型検査で弾かれるため any 経由で問い合わせる
      .select("api_key" as never)
      .limit(1);
    expect(plaintextColumnError).not.toBeNull();
  });
});
