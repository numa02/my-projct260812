import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input, Textarea } from "./Input";

describe("Input", () => {
  it("labelとinputが関連付けられる", () => {
    render(<Input label="メールアドレス" type="email" />);
    expect(screen.getByLabelText("メールアドレス")).toHaveAttribute("type", "email");
  });

  it("入力するとonChangeが呼ばれる", async () => {
    const onChange = vi.fn();
    render(<Input label="クラス名" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("クラス名"), "1組");
    expect(onChange).toHaveBeenCalled();
  });

  it("error指定時はエラーメッセージとaria-invalidが付く", () => {
    render(<Input label="パスワード" type="password" error="8文字以上で入力してください" />);
    const input = screen.getByLabelText("パスワード");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("8文字以上で入力してください")).toBeInTheDocument();
  });

  it("disabledのときは編集できない", () => {
    render(<Input label="出席番号" type="number" disabled />);
    expect(screen.getByLabelText("出席番号")).toBeDisabled();
  });
});

describe("Textarea", () => {
  it("複数行入力として使える", async () => {
    const onChange = vi.fn();
    render(<Textarea label="メモ" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("メモ"), "よく発言していた");
    expect(onChange).toHaveBeenCalled();
  });
});
