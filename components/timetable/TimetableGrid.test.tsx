import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimetableGrid, type TimetableCell } from "./TimetableGrid";

const cells: TimetableCell[] = [
  { weekday: 1, period: 1, subjectLabel: "国語", classLabel: "1年1組" },
  { weekday: 1, period: 2, subjectLabel: null, classLabel: null },
  { weekday: 2, period: 1, subjectLabel: "算数", classLabel: "1年1組", changed: true },
];

describe("TimetableGrid", () => {
  it("科目・クラスが設定されたマスを表示する", () => {
    render(<TimetableGrid mode="master" cells={cells} />);
    expect(screen.getByText("国語")).toBeInTheDocument();
    expect(screen.getAllByText("1年1組")).toHaveLength(2);
  });

  it("未設定のマスは「未設定」と表示される", () => {
    render(<TimetableGrid mode="master" cells={cells} />);
    expect(screen.getAllByText("未設定").length).toBeGreaterThan(0);
  });

  it("週次時間割モードでは個別変更ありのマスにBadgeが表示される", () => {
    render(<TimetableGrid mode="weekly" cells={cells} />);
    expect(screen.getByText("変更あり")).toBeInTheDocument();
  });

  it("マスタモードでは個別変更ありのBadgeを出さない", () => {
    render(<TimetableGrid mode="master" cells={cells} />);
    expect(screen.queryByText("変更あり")).not.toBeInTheDocument();
  });

  it("onLifeCellClickがない場合は「生活記録」行を表示しない", () => {
    render(<TimetableGrid mode="master" cells={cells} />);
    expect(screen.queryByRole("rowheader", { name: "生活記録" })).not.toBeInTheDocument();
  });

  it("onLifeCellClickがある場合、「生活記録」行の曜日のマスを押すとその曜日番号が渡される", async () => {
    const onLifeCellClick = vi.fn();
    render(<TimetableGrid mode="weekly" cells={cells} onLifeCellClick={onLifeCellClick} />);
    expect(screen.getByRole("rowheader", { name: "生活記録" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("gridcell", { name: "水曜の生活記録" }));
    expect(onLifeCellClick).toHaveBeenCalledWith(3);
  });

  it("onCellClickがある場合、マスクリックでコールバックにセルが渡される", async () => {
    const onCellClick = vi.fn();
    render(<TimetableGrid mode="master" cells={cells} onCellClick={onCellClick} />);
    await userEvent.click(screen.getByText("国語"));
    expect(onCellClick).toHaveBeenCalledWith(cells[0]);
  });
});
