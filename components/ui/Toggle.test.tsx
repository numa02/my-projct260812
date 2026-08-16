import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
  it("初期値onで表示される", () => {
    render(<Toggle checked onChange={() => {}} label="共有区分" />);
    expect(screen.getByRole("switch", { name: "共有区分" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("クリックでonChangeにトグル後の値が渡される", async () => {
    const onChange = vi.fn();
    render(<Toggle checked onChange={onChange} label="共有区分" />);
    await userEvent.click(screen.getByRole("switch", { name: "共有区分" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("disabledのときは操作できない", async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} disabled label="共有区分" />);
    await userEvent.click(screen.getByRole("switch", { name: "共有区分" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
