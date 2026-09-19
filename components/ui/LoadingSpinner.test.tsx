import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FullScreenLoading, LoadingSpinner } from "./LoadingSpinner";

describe("LoadingSpinner", () => {
  it("labelを指定すると状況テキストが表示される", () => {
    render(<LoadingSpinner label="生成中..." />);
    expect(screen.getByRole("status")).toHaveTextContent("生成中...");
  });

  it("labelがない場合はスクリーンリーダー向けテキストのみ持つ", () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole("status")).toHaveTextContent("読み込み中");
  });
});

describe("FullScreenLoading", () => {
  it("フルスクリーンで表示される", () => {
    render(<FullScreenLoading label="AIが所見を生成しています" />);
    expect(screen.getByRole("status")).toHaveTextContent("AIが所見を生成しています");
  });
});
