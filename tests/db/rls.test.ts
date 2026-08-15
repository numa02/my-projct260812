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
