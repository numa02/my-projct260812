import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlobalNav } from "./GlobalNav";

const navItems = [
  { href: "/classes", label: "クラス管理" },
  { href: "/students", label: "生徒名簿" },
];

describe("GlobalNav", () => {
  it("現在の画面に対応する項目がaria-current=pageになる", () => {
    render(<GlobalNav navItems={navItems} currentPath="/students" onLogout={() => {}} />);
    expect(screen.getByRole("link", { name: "生徒名簿" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "クラス管理" })).not.toHaveAttribute("aria-current");
  });

  it("ログアウトボタンでonLogoutが呼ばれる", async () => {
    const onLogout = vi.fn();
    render(<GlobalNav navItems={navItems} currentPath="/students" onLogout={onLogout} />);
    await userEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("h-screen+overflow-y-autoで独立スクロールする構造になっている", () => {
    render(<GlobalNav navItems={navItems} currentPath="/students" onLogout={() => {}} />);
    expect(screen.getByRole("complementary")).toHaveClass("h-screen", "overflow-y-auto");
  });
});
