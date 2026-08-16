import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton, SkeletonRow } from "./Skeleton";

describe("Skeleton", () => {
  it("装飾要素としてレンダリングされる(スクリーンリーダーからは隠す)", () => {
    render(<Skeleton className="h-4 w-full" data-testid="skeleton" />);
    expect(screen.getByTestId("skeleton")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("SkeletonRow", () => {
  it("指定した列数分のプレースホルダーを描画する", () => {
    const { container } = render(<SkeletonRow columns={3} />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });
});
