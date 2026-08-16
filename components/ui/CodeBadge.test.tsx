import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CodeBadge } from "./CodeBadge";

describe("CodeBadge", () => {
  it("仮名コードを表示する", () => {
    render(<CodeBadge code="1-03-10" />);
    expect(screen.getByText("1-03-10")).toBeInTheDocument();
  });
});
