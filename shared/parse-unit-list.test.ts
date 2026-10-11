import { describe, expect, it } from "vitest";
import { parseUnitNames } from "./parse-unit-list";

describe("parseUnitNames", () => {
  it("1行1単元として、貼り付けた順に抽出する", () => {
    const raw = ["分数のかけ算", "円の面積", "比例と反比例"].join("\n");
    expect(parseUnitNames(raw)).toEqual(["分数のかけ算", "円の面積", "比例と反比例"]);
  });

  it("タブ区切りの行は先頭の列だけを単元名にする(時数などの列を拾わない)", () => {
    const raw = ["分数のかけ算\t12", "円の面積\t8"].join("\n");
    expect(parseUnitNames(raw)).toEqual(["分数のかけ算", "円の面積"]);
  });

  it("カンマ区切りの行も先頭の列だけを単元名にする", () => {
    expect(parseUnitNames("分数のかけ算,12\n円の面積,8")).toEqual(["分数のかけ算", "円の面積"]);
  });

  it("タブとカンマが混ざる行はタブを優先して区切る", () => {
    // 「大きい数,くらべ方」のように単元名に半角カンマを含む場合でも、タブがあれば切れない
    expect(parseUnitNames("大きい数,くらべ方\t12")).toEqual(["大きい数,くらべ方"]);
  });

  it("空行・空白だけの行を無視する", () => {
    expect(parseUnitNames("分数のかけ算\n\n   \n円の面積")).toEqual(["分数のかけ算", "円の面積"]);
  });

  it("先頭の列が空の行を無視する", () => {
    expect(parseUnitNames("\t12\n分数のかけ算\t8")).toEqual(["分数のかけ算"]);
  });

  it("前後の空白をトリムする", () => {
    expect(parseUnitNames("  分数のかけ算  \n 円の面積 ")).toEqual(["分数のかけ算", "円の面積"]);
  });

  it("重複する単元名は初出順で1件にまとめる", () => {
    expect(parseUnitNames("分数のかけ算\n円の面積\n分数のかけ算")).toEqual([
      "分数のかけ算",
      "円の面積",
    ]);
  });

  it("全角読点を含む単元名は切れない", () => {
    expect(parseUnitNames("大きい数、くらべ方")).toEqual(["大きい数、くらべ方"]);
  });

  it("空文字列の場合は空配列を返す", () => {
    expect(parseUnitNames("")).toEqual([]);
  });

  it("空白と改行だけの場合は空配列を返す", () => {
    expect(parseUnitNames("  \n\n \t \n")).toEqual([]);
  });
});
