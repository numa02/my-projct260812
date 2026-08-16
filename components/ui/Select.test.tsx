import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "./Select";

const options = [
  { value: "1", label: "1年1組" },
  { value: "2", label: "1年2組" },
];

describe("Select", () => {
  it("選択肢から選ぶとonChangeが呼ばれる", async () => {
    const onChange = vi.fn();
    render(<Select label="クラス" options={options} value="1" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText("クラス"), "2");
    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("選択肢が0件のときはemptyMessageを表示しselect自体を出さない", () => {
    render(
      <Select
        label="科目"
        options={[]}
        value=""
        onChange={() => {}}
        emptyMessage="先に科目を登録してください"
      />,
    );
    expect(screen.getByText("先に科目を登録してください")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("disabledのときは操作できない", () => {
    render(<Select label="クラス" options={options} value="1" onChange={() => {}} disabled />);
    expect(screen.getByLabelText("クラス")).toBeDisabled();
  });
});
