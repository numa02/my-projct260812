import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Table } from "./Table";

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = [
  { id: "1", name: "1年1組" },
  { id: "2", name: "1年2組" },
];
const columns = [{ key: "name", header: "クラス名", render: (row: Row) => row.name }];

describe("Table", () => {
  it("行データを表示する", () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(screen.getByText("1年1組")).toBeInTheDocument();
    expect(screen.getByText("1年2組")).toBeInTheDocument();
  });

  it("loading中はスケルトンを表示しデータ行は出さない", () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.id} loading />);
    expect(screen.queryByText("1年1組")).not.toBeInTheDocument();
  });

  it("0件のときはemptyStateを表示する", () => {
    render(
      <Table
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        emptyState={<div>クラスがありません</div>}
      />,
    );
    expect(screen.getByText("クラスがありません")).toBeInTheDocument();
  });
});
