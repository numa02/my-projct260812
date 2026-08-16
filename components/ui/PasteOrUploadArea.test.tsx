import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasteOrUploadArea } from "./PasteOrUploadArea";

describe("PasteOrUploadArea", () => {
  it("テキスト貼り付けモードで取り込みを実行するとonImportが呼ばれる", async () => {
    const onImport = vi.fn();
    render(<PasteOrUploadArea onImport={onImport} />);

    await userEvent.click(screen.getByRole("radio", { name: "テキスト貼り付け" }));
    await userEvent.type(
      screen.getByLabelText(/出席番号,氏名/),
      "1,生徒A\n2,生徒B",
    );
    await userEvent.click(screen.getByRole("button", { name: "取り込む" }));

    expect(onImport).toHaveBeenCalledWith("1,生徒A\n2,生徒B");
  });

  it("エラー行がある場合は理由付きで一覧表示される", () => {
    render(
      <PasteOrUploadArea
        onImport={() => {}}
        errorRows={[
          { rowIndex: 3, reason: "MISSING_FIELD", name: null },
          { rowIndex: 5, reason: "DUPLICATE_IN_BATCH", name: "生徒C" },
        ]}
      />,
    );
    expect(screen.getByText("2件のエラーがあります")).toBeInTheDocument();
    expect(screen.getByText(/3行目: 出席番号または氏名が空です/)).toBeInTheDocument();
    expect(
      screen.getByText(/5行目: 取り込みデータ内で出席番号が重複しています\(生徒C\)/),
    ).toBeInTheDocument();
  });
});
