import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("案内文のみ表示できる(アクションなし)", () => {
    render(<EmptyState message="まだクラスがありません" />);
    expect(screen.getByText("まだクラスがありません")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("アクションボタン付きで表示でき、クリックでonActionが呼ばれる", async () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        message="まだクラスがありません"
        actionLabel="クラスを作成"
        onAction={onAction}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "クラスを作成" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
