import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollapsibleList } from "./CollapsibleList";

interface Student {
  id: string;
  name: string;
}

const rows: Student[] = [
  { id: "1", name: "生徒A" },
  { id: "2", name: "生徒B" },
];

describe("CollapsibleList", () => {
  it("展開中の行だけexpandedの内容が表示され、他の行には影響しない", () => {
    render(
      <CollapsibleList
        rows={rows}
        rowKey={(r) => r.id}
        renderSummary={(r) => r.name}
        renderExpanded={(r) => <div>{r.name}のメモ入力欄</div>}
        expandedRowId="1"
        onToggleRow={() => {}}
      />,
    );
    expect(screen.getByText("生徒Aのメモ入力欄")).toBeInTheDocument();
    expect(screen.queryByText("生徒Bのメモ入力欄")).not.toBeInTheDocument();
  });

  it("行をクリックするとonToggleRowにその行のidが渡される", async () => {
    const onToggleRow = vi.fn();
    render(
      <CollapsibleList
        rows={rows}
        rowKey={(r) => r.id}
        renderSummary={(r) => r.name}
        renderExpanded={(r) => <div>{r.name}のメモ入力欄</div>}
        expandedRowId={null}
        onToggleRow={onToggleRow}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "生徒B" }));
    expect(onToggleRow).toHaveBeenCalledWith("2");
  });

  it("0件のときはemptyStateを表示する", () => {
    render(
      <CollapsibleList
        rows={[]}
        rowKey={(r: Student) => r.id}
        renderSummary={(r) => r.name}
        renderExpanded={(r) => r.name}
        expandedRowId={null}
        onToggleRow={() => {}}
        emptyState={<div>この時間には生徒がいません</div>}
      />,
    );
    expect(screen.getByText("この時間には生徒がいません")).toBeInTheDocument();
  });
});
