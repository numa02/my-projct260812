import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("ラベルテキストを表示する(色のみに依存しない)", () => {
    render(<Badge variant="shared" label="共有する" />);
    expect(screen.getByText("共有する")).toBeInTheDocument();
  });

  it("recordedバリアントはドットインジケーターを併記する", () => {
    const { container } = render(<Badge variant="recorded" label="入力済み" />);
    expect(container.querySelector(".rounded-full")).toBeInTheDocument();
  });
});
