import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("確認・キャンセルそれぞれのコールバックが呼ばれる", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="生徒を削除しますか"
        body="メモ・所感も完全に削除されます"
        open
        variant="danger"
        confirmLabel="削除する"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "削除する" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("loading中は確定ボタンがローディング表示になる", () => {
    render(
      <ConfirmDialog
        title="上書きしますか"
        body="既存の所感を上書きします"
        open
        loading
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "続行" })).toBeDisabled();
  });
});
