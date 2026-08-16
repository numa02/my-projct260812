import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "./SegmentedControl";

const options = [
  { value: "bulk", label: "一括モード" },
  { value: "per-class", label: "教科担任制モード" },
];

describe("SegmentedControl", () => {
  it("選択中の項目がaria-checkedで示される", () => {
    render(
      <SegmentedControl
        options={options}
        value="bulk"
        onChange={() => {}}
        aria-label="時間割入力モード"
      />,
    );
    expect(screen.getByRole("radio", { name: "一括モード" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "教科担任制モード" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("クリックで選択が切り替わる", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        options={options}
        value="bulk"
        onChange={onChange}
        aria-label="時間割入力モード"
      />,
    );
    await userEvent.click(screen.getByRole("radio", { name: "教科担任制モード" }));
    expect(onChange).toHaveBeenCalledWith("per-class");
  });
});
