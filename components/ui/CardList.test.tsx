import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CardList } from "./CardList";

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = [{ id: "1", name: "1年1組" }];

describe("CardList", () => {
  it("renderItemの内容をカードとして表示する", () => {
    render(<CardList rows={rows} rowKey={(r) => r.id} renderItem={(r) => <p>{r.name}</p>} />);
    expect(screen.getByText("1年1組")).toBeInTheDocument();
  });

  it("0件のときはemptyStateを表示する", () => {
    render(
      <CardList
        rows={[]}
        rowKey={(r: Row) => r.id}
        renderItem={(r) => r.name}
        emptyState={<div>データがありません</div>}
      />,
    );
    expect(screen.getByText("データがありません")).toBeInTheDocument();
  });
});
