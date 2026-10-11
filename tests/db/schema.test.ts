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
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBe(teacher.id);
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

describe("unit(UN-001)", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  /** 単元を1件作る。unitはteacher_idを持たないため、subject_idだけを渡す */
  async function createUnit(t: TestTeacher, subjectId: string, name: string) {
    const { data, error } = await t.client
      .from("unit")
      .insert({ subject_id: subjectId, name })
      .select()
      .single<{ id: string }>();
    expect(error).toBeNull();
    return data!.id;
  }

  it("teacher_idを渡さずに自分の科目の単元を作れる(所有者はsubject経由で決まる)", async () => {
    teacher = await createTestTeacher();
    const { subjectId } = await createClassWithStudent(teacher);

    const unitId = await createUnit(teacher, subjectId, "分数のかけ算");

    const { data } = await teacher.client.from("unit").select("id, name, subject_id").eq("id", unitId);
    expect(data).toEqual([{ id: unitId, name: "分数のかけ算", subject_id: subjectId }]);
  });

  it("同じ科目内の単元名の重複が許可される(科目名と同じ方針)", async () => {
    teacher = await createTestTeacher();
    const { subjectId } = await createClassWithStudent(teacher);

    await createUnit(teacher, subjectId, "分数のかけ算");
    await createUnit(teacher, subjectId, "分数のかけ算");

    const { data } = await teacher.client.from("unit").select("id").eq("name", "分数のかけ算");
    expect(data).toHaveLength(2);
  });

  it("メモの単元は同じ科目の単元でなければ保存できない(複合外部キー)", async () => {
    teacher = await createTestTeacher();
    const { studentId, subjectId } = await createClassWithStudent(teacher);
    // 別の科目に属する単元
    const { data: otherSubject } = await teacher.client
      .from("subject")
      .insert({ teacher_id: teacher.id, name: "算数" })
      .select()
      .single<{ id: string }>();
    const otherUnitId = await createUnit(teacher, otherSubject!.id, "分数のかけ算");

    const { error } = await teacher.client.from("memo").insert({
      student_id: studentId,
      subject_id: subjectId,
      unit_id: otherUnitId,
      note_date: "2026-04-10",
      period: 1,
      content: "メモ",
    });
    expect(error).not.toBeNull();
  });

  it("単元未設定(unit_id=null)のメモは従来どおり保存できる", async () => {
    teacher = await createTestTeacher();
    const { studentId, subjectId } = await createClassWithStudent(teacher);

    const { error } = await teacher.client.from("memo").insert({
      student_id: studentId,
      subject_id: subjectId,
      unit_id: null,
      note_date: "2026-04-10",
      period: 1,
      content: "メモ",
    });
    expect(error).toBeNull();
  });

  it("単元を削除するとメモの単元だけがnullに戻り、メモ自体は残る", async () => {
    teacher = await createTestTeacher();
    const { studentId, subjectId } = await createClassWithStudent(teacher);
    const unitId = await createUnit(teacher, subjectId, "分数のかけ算");

    await teacher.client.from("memo").insert({
      student_id: studentId,
      subject_id: subjectId,
      unit_id: unitId,
      note_date: "2026-04-10",
      period: 1,
      content: "メモ",
    });

    const { error: deleteError } = await teacher.client.from("unit").delete().eq("id", unitId);
    expect(deleteError).toBeNull();

    const { data } = await teacher.client
      .from("memo")
      .select("unit_id, subject_id, content")
      .eq("student_id", studentId);
    // subject_id は not null のため、複合外部キーのset nullがunit_idだけに効いている必要がある
    expect(data).toEqual([{ unit_id: null, subject_id: subjectId, content: "メモ" }]);
  });

  it("単元名を更新するとupdated_atが進む", async () => {
    teacher = await createTestTeacher();
    const { subjectId } = await createClassWithStudent(teacher);
    const unitId = await createUnit(teacher, subjectId, "分数のかけ算");

    const { data: before } = await teacher.client
      .from("unit")
      .select("updated_at")
      .eq("id", unitId)
      .single<{ updated_at: string }>();

    await teacher.client.from("unit").update({ name: "円の面積" }).eq("id", unitId);

    const { data: after } = await teacher.client
      .from("unit")
      .select("updated_at")
      .eq("id", unitId)
      .single<{ updated_at: string }>();

    expect(new Date(after!.updated_at).getTime()).toBeGreaterThan(
      new Date(before!.updated_at).getTime(),
    );
  });
});

describe("student_comment", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("(student_id)のユニーク制約でupsertが機能する(T-014、CM-014でフェーズ2適用後の新仕様に更新)", async () => {
    teacher = await createTestTeacher();
    const { studentId } = await createClassWithStudent(teacher);

    const commentInput = {
      student_id: studentId,
      content: "最初の所見",
      creation_method: "manual" as const,
    };

    const { error: insertError } = await teacher.client
      .from("student_comment")
      .upsert(commentInput, { onConflict: "student_id" });
    expect(insertError).toBeNull();

    const { data: upserted, error: upsertError } = await teacher.client
      .from("student_comment")
      .upsert(
        { ...commentInput, content: "更新後の所見" },
        { onConflict: "student_id" },
      )
      .select();
    expect(upsertError).toBeNull();
    expect(upserted).toHaveLength(1);
    expect(upserted?.[0].content).toBe("更新後の所見");
  });
});

describe("life_memo", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("(student_id, note_date)のユニーク制約で1人1日1件になり、upsertで上書きできる(LS-002)", async () => {
    teacher = await createTestTeacher();
    const { studentId } = await createClassWithStudent(teacher);

    const { error: insertError } = await teacher.client
      .from("life_memo")
      .insert({ student_id: studentId, note_date: "2026-04-10", content: "最初の生活メモ" });
    expect(insertError).toBeNull();

    // 同じ生徒・同じ日付の2件目はinsertできない
    const { error: duplicateError } = await teacher.client
      .from("life_memo")
      .insert({ student_id: studentId, note_date: "2026-04-10", content: "2件目" });
    expect(duplicateError?.code).toBe("23505");

    const { data: upserted, error: upsertError } = await teacher.client
      .from("life_memo")
      .upsert(
        { student_id: studentId, note_date: "2026-04-10", content: "更新後の生活メモ" },
        { onConflict: "student_id,note_date" },
      )
      .select();
    expect(upsertError).toBeNull();
    expect(upserted).toHaveLength(1);
    expect(upserted?.[0].content).toBe("更新後の生活メモ");
    expect(upserted?.[0].share_flag).toBe("shared");
  });
});

describe("student_life_comment", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("(student_id)のユニーク制約でupsertが機能し、学習の所見とは独立に保持される(LS-002)", async () => {
    teacher = await createTestTeacher();
    const { studentId } = await createClassWithStudent(teacher);

    await teacher.client
      .from("student_comment")
      .insert({ student_id: studentId, content: "学習の所見", creation_method: "manual" });

    const input = { student_id: studentId, content: "最初の生活の所見", creation_method: "manual" as const };
    const { error: insertError } = await teacher.client
      .from("student_life_comment")
      .upsert(input, { onConflict: "student_id" });
    expect(insertError).toBeNull();

    const { data: upserted, error: upsertError } = await teacher.client
      .from("student_life_comment")
      .upsert({ ...input, content: "更新後の生活の所見" }, { onConflict: "student_id" })
      .select();
    expect(upsertError).toBeNull();
    expect(upserted).toHaveLength(1);
    expect(upserted?.[0].content).toBe("更新後の生活の所見");

    const { data: learning } = await teacher.client
      .from("student_comment")
      .select("content")
      .eq("student_id", studentId)
      .single<{ content: string }>();
    expect(learning?.content).toBe("学習の所見");
  });
});

describe("updated_atの自動更新(BUG-009)", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("所見をupsertで上書きするとupdated_atが進む(3種類すべて)", async () => {
    teacher = await createTestTeacher();
    const { studentId } = await createClassWithStudent(teacher);

    const tables = ["student_comment", "student_life_comment", "student_general_comment"] as const;
    for (const table of tables) {
      const { data: inserted } = await teacher.client
        .from(table)
        .upsert(
          { student_id: studentId, content: "初回", creation_method: "manual" },
          { onConflict: "student_id" },
        )
        .select("updated_at")
        .single<{ updated_at: string }>();

      const { data: updated } = await teacher.client
        .from(table)
        .upsert(
          { student_id: studentId, content: "上書き", creation_method: "manual" },
          { onConflict: "student_id" },
        )
        .select("updated_at")
        .single<{ updated_at: string }>();

      expect(
        new Date(updated!.updated_at).getTime(),
        `${table}のupdated_atが上書き時に更新されていない`,
      ).toBeGreaterThan(new Date(inserted!.updated_at).getTime());
    }
  });

  it("メモを更新するとupdated_atが進む", async () => {
    teacher = await createTestTeacher();
    const { studentId, subjectId } = await createClassWithStudent(teacher);

    const { data: inserted } = await teacher.client
      .from("memo")
      .insert({
        student_id: studentId,
        subject_id: subjectId,
        note_date: "2026-04-06",
        period: 1,
        content: "初回",
      })
      .select("id, updated_at")
      .single<{ id: string; updated_at: string }>();

    const { data: updated } = await teacher.client
      .from("memo")
      .update({ content: "上書き" })
      .eq("id", inserted!.id)
      .select("updated_at")
      .single<{ updated_at: string }>();

    expect(new Date(updated!.updated_at).getTime()).toBeGreaterThan(
      new Date(inserted!.updated_at).getTime(),
    );
  });
});

describe("student_general_comment", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("(student_id)のユニーク制約でupsertが機能し、学習・生活の所見とは独立に保持される(GS-001)", async () => {
    teacher = await createTestTeacher();
    const { studentId } = await createClassWithStudent(teacher);

    await teacher.client
      .from("student_comment")
      .insert({ student_id: studentId, content: "学習の所見", creation_method: "manual" });
    await teacher.client
      .from("student_life_comment")
      .insert({ student_id: studentId, content: "生活の所見", creation_method: "manual" });

    const input = {
      student_id: studentId,
      content: "最初の総合の所見",
      creation_method: "manual" as const,
    };
    const { error: insertError } = await teacher.client
      .from("student_general_comment")
      .upsert(input, { onConflict: "student_id" });
    expect(insertError).toBeNull();

    const { data: upserted, error: upsertError } = await teacher.client
      .from("student_general_comment")
      .upsert({ ...input, content: "更新後の総合の所見" }, { onConflict: "student_id" })
      .select();
    expect(upsertError).toBeNull();
    expect(upserted).toHaveLength(1);
    expect(upserted?.[0].content).toBe("更新後の総合の所見");

    // 3種類が互いに影響しないこと
    const { data: learning } = await teacher.client
      .from("student_comment")
      .select("content")
      .eq("student_id", studentId)
      .single<{ content: string }>();
    expect(learning?.content).toBe("学習の所見");

    const { data: life } = await teacher.client
      .from("student_life_comment")
      .select("content")
      .eq("student_id", studentId)
      .single<{ content: string }>();
    expect(life?.content).toBe("生活の所見");
  });

  it("生徒を削除すると総合の所見も削除される(on delete cascade)", async () => {
    teacher = await createTestTeacher();
    const { studentId } = await createClassWithStudent(teacher);

    await teacher.client
      .from("student_general_comment")
      .insert({ student_id: studentId, content: "総合の所見", creation_method: "manual" });

    await teacher.client.from("student").delete().eq("id", studentId);

    const { data } = await teacher.client
      .from("student_general_comment")
      .select("id")
      .eq("student_id", studentId);
    expect(data).toHaveLength(0);
  });
});

describe("prompt_template", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("生活用だけを保存でき、その後の学習用の保存で生活用が消えない(LS-002)", async () => {
    teacher = await createTestTeacher();

    const { error: lifeError } = await teacher.client
      .from("prompt_template")
      .upsert({ teacher_id: teacher.id, life_content: "生活用" }, { onConflict: "teacher_id" });
    expect(lifeError).toBeNull();

    const { error: learningError } = await teacher.client
      .from("prompt_template")
      .upsert({ teacher_id: teacher.id, content: "学習用" }, { onConflict: "teacher_id" });
    expect(learningError).toBeNull();

    const { data } = await teacher.client
      .from("prompt_template")
      .select("content, life_content")
      .single<{ content: string | null; life_content: string | null }>();
    expect(data).toEqual({ content: "学習用", life_content: "生活用" });
  });

  it("総合用を追加で保存しても学習用・生活用が消えない(GS-001)", async () => {
    teacher = await createTestTeacher();

    await teacher.client
      .from("prompt_template")
      .upsert({ teacher_id: teacher.id, content: "学習用" }, { onConflict: "teacher_id" });
    await teacher.client
      .from("prompt_template")
      .upsert({ teacher_id: teacher.id, life_content: "生活用" }, { onConflict: "teacher_id" });

    const { error: generalError } = await teacher.client
      .from("prompt_template")
      .upsert({ teacher_id: teacher.id, general_content: "総合用" }, { onConflict: "teacher_id" });
    expect(generalError).toBeNull();

    const { data } = await teacher.client
      .from("prompt_template")
      .select("content, life_content, general_content")
      .single<{
        content: string | null;
        life_content: string | null;
        general_content: string | null;
      }>();
    expect(data).toEqual({ content: "学習用", life_content: "生活用", general_content: "総合用" });
  });

  it("「単元ごと」用の2つを含む5つのひな形が独立に保存される(UN-029)", async () => {
    teacher = await createTestTeacher();

    const saves: { column: string; value: string }[] = [
      { column: "content", value: "学習・まとめて" },
      { column: "unit_content", value: "学習・単元ごと" },
      { column: "life_content", value: "生活" },
      { column: "general_content", value: "総合・まとめて" },
      { column: "general_unit_content", value: "総合・単元ごと" },
    ];
    // 画面と同じく、1つずつ別々のupsertで保存する(送らなかった列は上書きされない)
    for (const save of saves) {
      const { error } = await teacher.client
        .from("prompt_template")
        .upsert({ teacher_id: teacher.id, [save.column]: save.value }, { onConflict: "teacher_id" });
      expect(error).toBeNull();
    }

    const { data } = await teacher.client
      .from("prompt_template")
      .select("content, unit_content, life_content, general_content, general_unit_content")
      .single();
    expect(data).toEqual({
      content: "学習・まとめて",
      unit_content: "学習・単元ごと",
      life_content: "生活",
      general_content: "総合・まとめて",
      general_unit_content: "総合・単元ごと",
    });
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
