import { describe, expect, it } from "vitest";
import { parseSubjectGridNames } from "./parse-subject-grid";

describe("parseSubjectGridNames", () => {
  it("タブ区切りの行から重複を除いた科目名を初出順で抽出する", () => {
    const raw = ["国語\t国語\t国語\t国語\t国語", "算数\t算数\t算数\t算数\t算数"].join("\n");
    expect(parseSubjectGridNames(raw)).toEqual(["国語", "算数"]);
  });

  it("カンマ区切りにも対応する", () => {
    expect(parseSubjectGridNames("国語,算数\n算数,理科")).toEqual(["国語", "算数", "理科"]);
  });

  it("空行・空セルを無視する", () => {
    expect(parseSubjectGridNames("国語,,算数\n\n")).toEqual(["国語", "算数"]);
  });

  it("前後の空白をトリムする", () => {
    expect(parseSubjectGridNames(" 国語 , 算数 ")).toEqual(["国語", "算数"]);
  });

  it("空文字列の場合は空配列を返す", () => {
    expect(parseSubjectGridNames("")).toEqual([]);
  });
});
