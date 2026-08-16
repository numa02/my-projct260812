import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Card } from "./Card";

describe("Card", () => {
  it("onClickがない場合はクリック不可のdivとして表示される", () => {
    render(<Card title="4/10(金) 1限" meta="国語" body="よく発言していた" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("よく発言していた")).toBeInTheDocument();
  });

  it("onClickがある場合はクリックでき、selectedがaria-pressedに反映される", async () => {
    const onClick = vi.fn();
    render(
      <Card
        title="2026年度前期"
        body="順調に成長しています"
        selected
        onClick={onClick}
      />,
    );
    const card = screen.getByRole("button", { name: /2026年度前期/ });
    expect(card).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
