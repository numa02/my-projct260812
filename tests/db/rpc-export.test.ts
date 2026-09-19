import { afterEach, describe, expect, it } from "vitest";
import { createTestTeacher, deleteTestTeacher, type TestTeacher } from "./helpers";

describe("export_teacher_data", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("生徒ごとにメモ・所見・生活メモ・生活の所見がまとまったJSONが返り、ai_provider_settingは含まれない(T-021, LS-002)", async () => {
    teacher = await createTestTeacher();

    const { data: klass } = await teacher.client
      .rpc("create_class", { p_grade: "1", p_display_name: "1年1組" })
      .single<{ id: string }>();
    const { data: subject } = await teacher.client
      .from("subject")
      .insert({ teacher_id: teacher.id, name: "国語" })
      .select()
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
      content: "メモ内容",
    });
    await teacher.client.from("student_comment").insert({
      student_id: student!.id,
      content: "所見内容",
      creation_method: "manual",
    });
    await teacher.client.from("life_memo").insert({
      student_id: student!.id,
      note_date: "2026-04-11",
      content: "生活メモ内容",
    });
    await teacher.client.from("student_life_comment").insert({
      student_id: student!.id,
      content: "生活の所見内容",
      creation_method: "manual",
    });
    await teacher.client
      .from("prompt_template")
      .insert({ teacher_id: teacher.id, content: "学習用ひな形", life_content: "生活用ひな形" });
    await teacher.client
      .from("ai_provider_setting")
      .insert({
        teacher_id: teacher.id,
        provider: "openai",
        model: "gpt-test",
        encrypted_api_key: "dummy",
      });

    const { data, error } = await teacher.client.rpc("export_teacher_data");
    expect(error).toBeNull();

    const result = data as {
      classes: Array<{ displayName: string }>;
      subjects: Array<{ name: string }>;
      students: Array<{
        name: string;
        memos: Array<{ content: string }>;
        comments: Array<{ content: string }>;
        lifeMemos: Array<{ content: string; noteDate: string }>;
        lifeComments: Array<{ content: string }>;
      }>;
      promptTemplate: { content: string | null; lifeContent: string | null } | null;
      aiProviderSetting?: unknown;
    };

    expect(result.classes).toEqual([expect.objectContaining({ displayName: "1年1組" })]);
    expect(result.subjects).toEqual([expect.objectContaining({ name: "国語" })]);
    expect(result.students).toHaveLength(1);
    expect(result.students[0].name).toBe("生徒A");
    expect(result.students[0].memos).toEqual([expect.objectContaining({ content: "メモ内容" })]);
    expect(result.students[0].comments).toEqual([
      expect.objectContaining({ content: "所見内容" }),
    ]);
    expect(result.students[0].lifeMemos).toEqual([
      expect.objectContaining({ content: "生活メモ内容", noteDate: "2026-04-11" }),
    ]);
    expect(result.students[0].lifeComments).toEqual([
      expect.objectContaining({ content: "生活の所見内容" }),
    ]);
    expect(result.promptTemplate).toEqual(
      expect.objectContaining({ content: "学習用ひな形", lifeContent: "生活用ひな形" }),
    );
    expect(result.aiProviderSetting).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("dummy");
  });

  it("データが1件もなくても空配列を返す(T-021)", async () => {
    teacher = await createTestTeacher();

    const { data, error } = await teacher.client.rpc("export_teacher_data");
    expect(error).toBeNull();

    const result = data as { classes: unknown[]; subjects: unknown[]; students: unknown[] };
    expect(result.classes).toEqual([]);
    expect(result.subjects).toEqual([]);
    expect(result.students).toEqual([]);
  });
});
