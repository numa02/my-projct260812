import { describe, expect, it } from "vitest";
import { parseRpcError } from "./rpc-error";

describe("parseRpcError", () => {
  it("CODE: メッセージ形式を分解する", () => {
    expect(parseRpcError({ message: "STUDENTS_EXIST: 生徒が登録されています" })).toEqual({
      code: "STUDENTS_EXIST",
      message: "生徒が登録されています",
    });
  });

  it("形式に合わない場合はUNKNOWNコードでメッセージ全体を返す", () => {
    expect(parseRpcError({ message: "予期しないエラー" })).toEqual({
      code: "UNKNOWN",
      message: "予期しないエラー",
    });
  });
});
