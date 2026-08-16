import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("クリックでonClickが呼ばれる", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>保存</Button>);
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabledのときはクリックできない", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        保存
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loadingのときは押下不可でスピナーが表示される", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} loading>
        保存
      </Button>,
    );
    const button = screen.getByRole("button", { name: "保存" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each(["primary", "secondary", "outline", "danger"] as const)(
    "variant=%sが指定できる",
    (variant) => {
      render(<Button variant={variant}>操作</Button>);
      expect(screen.getByRole("button", { name: "操作" })).toBeInTheDocument();
    },
  );
});
