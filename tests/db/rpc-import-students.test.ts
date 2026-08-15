import { afterEach, describe, expect, it } from "vitest";
import { createTestTeacher, deleteTestTeacher, type TestTeacher } from "./helpers";

describe("import_students", () => {
  let teacher: TestTeacher | undefined;

  afterEach(async () => {
    if (teacher) await deleteTestTeacher(teacher.id);
    teacher = undefined;
  });

  it("必須項目欠落・出席番号重複はエラー行として返り、有効な行だけ登録される(T-018)", async () => {
    teacher = await createTestTeacher();

    const { data: klass } = await teacher.client
      .rpc("create_class", { p_grade: "1", p_display_name: "1年1組" })
      .single<{ id: string }>();

    // 既存生徒(DB内既存重複チェック用)
    await teacher.client
      .from("student")
      .insert({ class_id: klass!.id, attendance_number: 5, name: "既存太郎" });

    const rows = [
      { attendanceNumber: 1, name: "生徒A" },
      { attendanceNumber: null, name: "氏名だけ" }, // 出席番号欠落
      { attendanceNumber: 2, name: "" }, // 氏名欠落
      { attendanceNumber: 3, name: "生徒B" },
      { attendanceNumber: 3, name: "生徒C" }, // バッチ内重複
      { attendanceNumber: 5, name: "重複太郎" }, // 既存と重複
    ];

    const { data, error } = await teacher.client
      .rpc("import_students", { p_class_id: klass!.id, p_rows: rows })
      .single<{ imported: unknown[]; errors: Array<{ reason: string }> }>();

    expect(error).toBeNull();
    expect(data?.imported).toHaveLength(2); // 生徒A, 生徒B
    expect(data?.errors).toHaveLength(4);
    expect(data?.errors.map((e) => e.reason).sort()).toEqual(
      ["DUPLICATE_EXISTING", "DUPLICATE_IN_BATCH", "MISSING_FIELD", "MISSING_FIELD"].sort(),
    );

    const { data: students } = await teacher.client
      .from("student")
      .select("attendance_number, name")
      .eq("class_id", klass!.id)
      .order("attendance_number");
    expect(students).toEqual([
      { attendance_number: 1, name: "生徒A" },
      { attendance_number: 3, name: "生徒B" },
      { attendance_number: 5, name: "既存太郎" },
    ]);
  });

  it("他教員のクラスIDを指定するとNOT_FOUNDエラーになる(T-018)", async () => {
    teacher = await createTestTeacher();
    const other = await createTestTeacher();
    try {
      const { data: otherClass } = await other.client
        .rpc("create_class", { p_grade: "1", p_display_name: "他教員のクラス" })
        .single<{ id: string }>();

      const { error } = await teacher.client.rpc("import_students", {
        p_class_id: otherClass!.id,
        p_rows: [{ attendanceNumber: 1, name: "生徒A" }],
      });
      expect(error?.message).toContain("NOT_FOUND");
    } finally {
      await deleteTestTeacher(other.id);
    }
  });
});
