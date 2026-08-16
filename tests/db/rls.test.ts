import { afterEach, describe, expect, it } from "vitest";
import { createTestTeacher, deleteTestTeacher, type TestTeacher } from "./helpers";

describe("class RLS", () => {
  let teacherA: TestTeacher | undefined;
  let teacherB: TestTeacher | undefined;

  afterEach(async () => {
    if (teacherA) await deleteTestTeacher(teacherA.id);
    if (teacherB) await deleteTestTeacher(teacherB.id);
    teacherA = undefined;
    teacherB = undefined;
  });

  it("他教員IDでのclassへのアクセスがRLSで拒否される(T-008)", async () => {
    teacherA = await createTestTeacher();
    teacherB = await createTestTeacher();

    const { data: created, error: createError } = await teacherA.client
      .from("class")
      .insert({ teacher_id: teacherA.id, grade: "1", group_number: 1, display_name: "1年1組" })
      .select()
      .single<{ id: string }>();
    expect(createError).toBeNull();

    // teacherBのセッションでteacherAのクラスにアクセスしても見えない(RLSでフィルタされる)
    const { data: seenByB, error: selectError } = await teacherB.client
      .from("class")
      .select("id")
      .eq("id", created!.id);
    expect(selectError).toBeNull();
    expect(seenByB).toHaveLength(0);

    // teacher_idを偽装してteacherBがteacherAのクラスとして直接insertしようとしても拒否される
    const { error: spoofError } = await teacherB.client
      .from("class")
      .insert({ teacher_id: teacherA.id, grade: "2", group_number: 1, display_name: "偽装クラス" });
    expect(spoofError).not.toBeNull();

    // teacherBが直接updateしようとしても対象行が0件で無害に終わる
    const { data: updated } = await teacherB.client
      .from("class")
      .update({ display_name: "改ざん" })
      .eq("id", created!.id)
      .select();
    expect(updated).toHaveLength(0);
  });
});

describe("student RLS", () => {
  let teacherA: TestTeacher | undefined;
  let teacherB: TestTeacher | undefined;

  afterEach(async () => {
    if (teacherA) await deleteTestTeacher(teacherA.id);
    if (teacherB) await deleteTestTeacher(teacherB.id);
    teacherA = undefined;
    teacherB = undefined;
  });

  it("他教員のクラスに紐づく生徒へのアクセスがRLSで拒否される(T-009)", async () => {
    teacherA = await createTestTeacher();
    teacherB = await createTestTeacher();

    const { data: klass } = await teacherA.client
      .from("class")
      .insert({ teacher_id: teacherA.id, grade: "1", group_number: 1, display_name: "1年1組" })
      .select()
      .single<{ id: string }>();

    const { data: student, error: studentCreateError } = await teacherA.client
      .from("student")
      .insert({ class_id: klass!.id, attendance_number: 1, name: "生徒A" })
      .select()
      .single<{ id: string }>();
    expect(studentCreateError).toBeNull();

    const { data: seenByB, error: selectError } = await teacherB.client
      .from("student")
      .select("id")
      .eq("id", student!.id);
    expect(selectError).toBeNull();
    expect(seenByB).toHaveLength(0);

    // teacherBが他教員のクラスIDを指定して生徒を追加しようとしても拒否される
    const { error: spoofError } = await teacherB.client
      .from("student")
      .insert({ class_id: klass!.id, attendance_number: 2, name: "偽装生徒" });
    expect(spoofError).not.toBeNull();
  });
});

describe("subject RLS", () => {
  let teacherA: TestTeacher | undefined;
  let teacherB: TestTeacher | undefined;

  afterEach(async () => {
    if (teacherA) await deleteTestTeacher(teacherA.id);
    if (teacherB) await deleteTestTeacher(teacherB.id);
    teacherA = undefined;
    teacherB = undefined;
  });

  it("他教員IDでのsubjectへのアクセスがRLSで拒否される(T-010)", async () => {
    teacherA = await createTestTeacher();
    teacherB = await createTestTeacher();

    const { data: created } = await teacherA.client
      .from("subject")
      .insert({ teacher_id: teacherA.id, name: "国語" })
      .select()
      .single<{ id: string }>();

    const { data: seenByB } = await teacherB.client
      .from("subject")
      .select("id")
      .eq("id", created!.id);
    expect(seenByB).toHaveLength(0);

    const { error: spoofError } = await teacherB.client
      .from("subject")
      .insert({ teacher_id: teacherA.id, name: "偽装科目" });
    expect(spoofError).not.toBeNull();

    const { data: updated } = await teacherB.client
      .from("subject")
      .update({ name: "改ざん" })
      .eq("id", created!.id)
      .select();
    expect(updated).toHaveLength(0);
  });
});

describe("timetable_master_slot RLS", () => {
  let teacherA: TestTeacher | undefined;
  let teacherB: TestTeacher | undefined;

  afterEach(async () => {
    if (teacherA) await deleteTestTeacher(teacherA.id);
    if (teacherB) await deleteTestTeacher(teacherB.id);
    teacherA = undefined;
    teacherB = undefined;
  });

  it("他教員IDでのtimetable_master_slotへのアクセスがRLSで拒否される(T-011)", async () => {
    teacherA = await createTestTeacher();
    teacherB = await createTestTeacher();

    const { data: created } = await teacherA.client
      .from("timetable_master_slot")
      .insert({ teacher_id: teacherA.id, weekday: 1, period: 1 })
      .select()
      .single<{ id: string }>();

    const { data: seenByB } = await teacherB.client
      .from("timetable_master_slot")
      .select("id")
      .eq("id", created!.id);
    expect(seenByB).toHaveLength(0);

    const { error: spoofError } = await teacherB.client
      .from("timetable_master_slot")
      .insert({ teacher_id: teacherA.id, weekday: 2, period: 1 });
    expect(spoofError).not.toBeNull();

    const { data: updated } = await teacherB.client
      .from("timetable_master_slot")
      .update({ weekday: 3 })
      .eq("id", created!.id)
      .select();
    expect(updated).toHaveLength(0);
  });
});

describe("weekly_subject_override / weekly_class_override RLS", () => {
  let teacherA: TestTeacher | undefined;
  let teacherB: TestTeacher | undefined;

  afterEach(async () => {
    if (teacherA) await deleteTestTeacher(teacherA.id);
    if (teacherB) await deleteTestTeacher(teacherB.id);
    teacherA = undefined;
    teacherB = undefined;
  });

  it("他教員IDでのweekly_subject_overrideへのアクセスがRLSで拒否される(T-012)", async () => {
    teacherA = await createTestTeacher();
    teacherB = await createTestTeacher();

    const { data: created } = await teacherA.client
      .from("weekly_subject_override")
      .insert({ teacher_id: teacherA.id, week_start_date: "2026-04-06", weekday: 1, period: 1 })
      .select()
      .single<{ id: string }>();

    const { data: seenByB } = await teacherB.client
      .from("weekly_subject_override")
      .select("id")
      .eq("id", created!.id);
    expect(seenByB).toHaveLength(0);

    const { error: spoofError } = await teacherB.client
      .from("weekly_subject_override")
      .insert({ teacher_id: teacherA.id, week_start_date: "2026-04-06", weekday: 2, period: 1 });
    expect(spoofError).not.toBeNull();
  });

  it("他教員IDでのweekly_class_overrideへのアクセスがRLSで拒否される(T-012)", async () => {
    teacherA = await createTestTeacher();
    teacherB = await createTestTeacher();

    const { data: klass } = await teacherA.client
      .from("class")
      .insert({ teacher_id: teacherA.id, grade: "1", group_number: 1, display_name: "1年1組" })
      .select()
      .single<{ id: string }>();

    const { data: created } = await teacherA.client
      .from("weekly_class_override")
      .insert({
        teacher_id: teacherA.id,
        week_start_date: "2026-04-06",
        weekday: 1,
        period: 1,
        class_id: klass!.id,
      })
      .select()
      .single<{ id: string }>();

    const { data: seenByB } = await teacherB.client
      .from("weekly_class_override")
      .select("id")
      .eq("id", created!.id);
    expect(seenByB).toHaveLength(0);

    const { error: spoofError } = await teacherB.client.from("weekly_class_override").insert({
      teacher_id: teacherA.id,
      week_start_date: "2026-04-06",
      weekday: 2,
      period: 1,
      class_id: klass!.id,
    });
    expect(spoofError).not.toBeNull();
  });
});

describe("memo RLS", () => {
  let teacherA: TestTeacher | undefined;
  let teacherB: TestTeacher | undefined;

  afterEach(async () => {
    if (teacherA) await deleteTestTeacher(teacherA.id);
    if (teacherB) await deleteTestTeacher(teacherB.id);
    teacherA = undefined;
    teacherB = undefined;
  });

  it("他教員の生徒に紐づくmemoへのアクセスがRLSで拒否される(T-013)", async () => {
    teacherA = await createTestTeacher();
    teacherB = await createTestTeacher();

    const { data: klass } = await teacherA.client
      .from("class")
      .insert({ teacher_id: teacherA.id, grade: "1", group_number: 1, display_name: "1年1組" })
      .select()
      .single<{ id: string }>();
    const { data: student } = await teacherA.client
      .from("student")
      .insert({ class_id: klass!.id, attendance_number: 1, name: "生徒A" })
      .select()
      .single<{ id: string }>();
    const { data: subject } = await teacherA.client
      .from("subject")
      .insert({ teacher_id: teacherA.id, name: "国語" })
      .select()
      .single<{ id: string }>();
    const { data: memo } = await teacherA.client
      .from("memo")
      .insert({
        student_id: student!.id,
        subject_id: subject!.id,
        note_date: "2026-04-10",
        period: 1,
        content: "メモ内容",
      })
      .select()
      .single<{ id: string }>();

    const { data: seenByB } = await teacherB.client.from("memo").select("id").eq("id", memo!.id);
    expect(seenByB).toHaveLength(0);

    // teacherBが他教員の生徒IDを指定してメモを追加しようとしても拒否される
    const { error: spoofError } = await teacherB.client.from("memo").insert({
      student_id: student!.id,
      subject_id: subject!.id,
      note_date: "2026-04-11",
      period: 2,
      content: "偽装メモ",
    });
    expect(spoofError).not.toBeNull();

    const { data: updated } = await teacherB.client
      .from("memo")
      .update({ content: "改ざん" })
      .eq("id", memo!.id)
      .select();
    expect(updated).toHaveLength(0);
  });
});

describe("student_comment RLS", () => {
  let teacherA: TestTeacher | undefined;
  let teacherB: TestTeacher | undefined;

  afterEach(async () => {
    if (teacherA) await deleteTestTeacher(teacherA.id);
    if (teacherB) await deleteTestTeacher(teacherB.id);
    teacherA = undefined;
    teacherB = undefined;
  });

  it("他教員の生徒に紐づくstudent_commentへのアクセスがRLSで拒否される(T-014)", async () => {
    teacherA = await createTestTeacher();
    teacherB = await createTestTeacher();

    const { data: klass } = await teacherA.client
      .from("class")
      .insert({ teacher_id: teacherA.id, grade: "1", group_number: 1, display_name: "1年1組" })
      .select()
      .single<{ id: string }>();
    const { data: student } = await teacherA.client
      .from("student")
      .insert({ class_id: klass!.id, attendance_number: 1, name: "生徒A" })
      .select()
      .single<{ id: string }>();
    const { data: comment } = await teacherA.client
      .from("student_comment")
      .insert({
        student_id: student!.id,
        period_start_date: "2026-04-01",
        period_end_date: "2026-04-30",
        content: "所感内容",
        creation_method: "manual",
      })
      .select()
      .single<{ id: string }>();

    const { data: seenByB } = await teacherB.client
      .from("student_comment")
      .select("id")
      .eq("id", comment!.id);
    expect(seenByB).toHaveLength(0);

    const { error: spoofError } = await teacherB.client.from("student_comment").insert({
      student_id: student!.id,
      period_start_date: "2026-05-01",
      period_end_date: "2026-05-31",
      content: "偽装所感",
      creation_method: "manual",
    });
    expect(spoofError).not.toBeNull();

    const { data: updated } = await teacherB.client
      .from("student_comment")
      .update({ content: "改ざん" })
      .eq("id", comment!.id)
      .select();
    expect(updated).toHaveLength(0);
  });
});

describe("ai_provider_setting / prompt_template RLS", () => {
  let teacherA: TestTeacher | undefined;
  let teacherB: TestTeacher | undefined;

  afterEach(async () => {
    if (teacherA) await deleteTestTeacher(teacherA.id);
    if (teacherB) await deleteTestTeacher(teacherB.id);
    teacherA = undefined;
    teacherB = undefined;
  });

  it("他教員IDでのai_provider_settingへのアクセスがRLSで拒否される(T-015)", async () => {
    teacherA = await createTestTeacher();
    teacherB = await createTestTeacher();

    const { data: created } = await teacherA.client
      .from("ai_provider_setting")
      .insert({
        teacher_id: teacherA.id,
        provider: "openai",
        model: "gpt-test",
        encrypted_api_key: "dummy",
      })
      .select()
      .single<{ id: string }>();

    const { data: seenByB } = await teacherB.client
      .from("ai_provider_setting")
      .select("id")
      .eq("id", created!.id);
    expect(seenByB).toHaveLength(0);

    const { error: spoofError } = await teacherB.client.from("ai_provider_setting").insert({
      teacher_id: teacherA.id,
      provider: "openai",
      model: "gpt-test",
      encrypted_api_key: "spoofed",
    });
    expect(spoofError).not.toBeNull();

    const { data: updated } = await teacherB.client
      .from("ai_provider_setting")
      .update({ model: "改ざん" })
      .eq("id", created!.id)
      .select();
    expect(updated).toHaveLength(0);
  });

  it("他教員IDでのprompt_templateへのアクセスがRLSで拒否される(T-015)", async () => {
    teacherA = await createTestTeacher();
    teacherB = await createTestTeacher();

    const { data: created } = await teacherA.client
      .from("prompt_template")
      .insert({ teacher_id: teacherA.id, content: "ひな形" })
      .select()
      .single<{ id: string }>();

    const { data: seenByB } = await teacherB.client
      .from("prompt_template")
      .select("id")
      .eq("id", created!.id);
    expect(seenByB).toHaveLength(0);

    const { error: spoofError } = await teacherB.client
      .from("prompt_template")
      .insert({ teacher_id: teacherA.id, content: "偽装ひな形" });
    expect(spoofError).not.toBeNull();

    const { data: updated } = await teacherB.client
      .from("prompt_template")
      .update({ content: "改ざん" })
      .eq("id", created!.id)
      .select();
    expect(updated).toHaveLength(0);
  });
});
