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

describe("seed_standard_subjects", () => {
  let teacher: TestTeacher | undefined;
  let teacherB: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    if (teacherB) await deleteTestTeacher(teacherB.id);
    teacher = undefined;
    teacherB = undefined;
  });

  it("小学校セット(11科目)が投入される", async () => {
    teacher = await createTestTeacher();

    const { error } = await teacher.client.rpc("seed_standard_subjects", {
      p_school_level: "elementary",
    });
    expect(error).toBeNull();

    const { data: subjects } = await teacher.client.from("subject").select("name");
    const names = (subjects ?? []).map((s) => s.name).sort();
    expect(names).toEqual(
      ["国語", "算数", "理科", "社会", "英語", "図画工作", "体育", "音楽", "生活", "総合", "学活"].sort(),
    );
  });

  it("小学校セットには教科「生活」が含まれる", async () => {
    teacher = await createTestTeacher();

    const { error } = await teacher.client.rpc("seed_standard_subjects", {
      p_school_level: "elementary",
    });
    expect(error).toBeNull();

    const { data: subjects } = await teacher.client.from("subject").select("name").eq("name", "生活");
    expect(subjects).toHaveLength(1);
  });

  it("既に「生活」を手動登録済みの場合はスキップされる", async () => {
    teacher = await createTestTeacher();
    await teacher.client.from("subject").insert({ teacher_id: teacher.id, name: "生活" });

    const { data: result } = await teacher.client
      .rpc("seed_standard_subjects", { p_school_level: "elementary" })
      .single<{ inserted: string[] }>();
    expect(result?.inserted).not.toContain("生活");

    const { data: subjects } = await teacher.client.from("subject").select("id").eq("name", "生活");
    expect(subjects).toHaveLength(1);
  });

  it("「生活」追加前の小学校セット(10科目)を投入済みの教員が再実行すると「生活」だけが追加される", async () => {
    teacher = await createTestTeacher();
    // 「生活」を追加する前の小学校セットを再現する
    const before = ["国語", "算数", "理科", "社会", "英語", "図画工作", "体育", "音楽", "総合", "学活"];
    await teacher.client
      .from("subject")
      .insert(before.map((name) => ({ teacher_id: teacher!.id, name })));

    const { data: result } = await teacher.client
      .rpc("seed_standard_subjects", { p_school_level: "elementary" })
      .single<{ inserted: string[] }>();
    expect(result?.inserted).toEqual(["生活"]);

    const { data: subjects } = await teacher.client.from("subject").select("name");
    const names = (subjects ?? []).map((s) => s.name);
    expect(names).toHaveLength(11);
    expect(new Set(names).size).toBe(11); // 既存の10科目が重複していない
  });

  it("中学校セットには教科「生活」が含まれない", async () => {
    teacher = await createTestTeacher();

    const { error } = await teacher.client.rpc("seed_standard_subjects", {
      p_school_level: "middle",
    });
    expect(error).toBeNull();

    const { data: subjects } = await teacher.client.from("subject").select("name").eq("name", "生活");
    expect(subjects).toHaveLength(0);
  });

  it("中学校セット(11科目)が投入される", async () => {
    teacher = await createTestTeacher();

    const { error } = await teacher.client.rpc("seed_standard_subjects", {
      p_school_level: "middle",
    });
    expect(error).toBeNull();

    const { data: subjects } = await teacher.client.from("subject").select("name");
    expect(subjects).toHaveLength(11);
    expect(subjects?.map((s) => s.name)).toContain("技術・家庭");
    expect(subjects?.map((s) => s.name)).toContain("保健体育");
  });

  it("既存科目と重複する項目はスキップされる", async () => {
    teacher = await createTestTeacher();
    await teacher.client.from("subject").insert({ teacher_id: teacher.id, name: "国語" });

    const { error } = await teacher.client.rpc("seed_standard_subjects", {
      p_school_level: "elementary",
    });
    expect(error).toBeNull();

    const { data: subjects } = await teacher.client.from("subject").select("id, name").eq("name", "国語");
    expect(subjects).toHaveLength(1); // 重複登録されていない
  });

  it("同一学校区分を2回連続実行しても2回目は0件追加される(冪等性)", async () => {
    teacher = await createTestTeacher();

    await teacher.client.rpc("seed_standard_subjects", { p_school_level: "elementary" });
    const { data: firstResult } = await teacher.client
      .rpc("seed_standard_subjects", { p_school_level: "elementary" })
      .single<{ inserted: string[] }>();
    expect(firstResult?.inserted).toEqual([]);

    const { count } = await teacher.client
      .from("subject")
      .select("id", { count: "exact", head: true });
    expect(count).toBe(11);
  });

  it("2つの呼び出しを同時実行しても合計で重複登録されない(advisory lockの検証)", async () => {
    teacher = await createTestTeacher();

    await Promise.all([
      teacher.client.rpc("seed_standard_subjects", { p_school_level: "elementary" }),
      teacher.client.rpc("seed_standard_subjects", { p_school_level: "elementary" }),
    ]);

    const { data: subjects } = await teacher.client.from("subject").select("name");
    const names = (subjects ?? []).map((s) => s.name);
    // 件数が11件ちょうどであること(2重登録されていないこと)
    expect(names).toHaveLength(11);
    // 各科目名が1件ずつであること
    expect(new Set(names).size).toBe(11);
  });

  it("不正な学校区分はINVALID_SCHOOL_LEVELエラーになる", async () => {
    teacher = await createTestTeacher();

    const { error } = await teacher.client.rpc("seed_standard_subjects", {
      p_school_level: "high",
    });
    expect(error?.message).toContain("INVALID_SCHOOL_LEVEL");
  });

  it("他教員の科目一覧には影響しない", async () => {
    teacher = await createTestTeacher();
    teacherB = await createTestTeacher();

    await teacher.client.rpc("seed_standard_subjects", { p_school_level: "elementary" });

    const { data: teacherBSubjects } = await teacherB.client.from("subject").select("id");
    expect(teacherBSubjects).toHaveLength(0);
  });
});
