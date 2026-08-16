import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("open=falseのときは何も描画しない", () => {
    render(
      <Modal title="マス編集" open={false} onClose={() => {}}>
        中身
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("open=trueのときはdialogとして描画される", () => {
    render(
      <Modal title="マス編集" open onClose={() => {}}>
        中身
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "マス編集" })).toBeInTheDocument();
    expect(screen.getByText("中身")).toBeInTheDocument();
  });

  it("閉じるボタンでonCloseが呼ばれる", async () => {
    const onClose = vi.fn();
    render(
      <Modal title="マス編集" open onClose={onClose}>
        中身
      </Modal>,
    );
    await userEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escapeキーでも閉じる", async () => {
    const onClose = vi.fn();
    render(
      <Modal title="マス編集" open onClose={onClose}>
        中身
      </Modal>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
