import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home", () => {
  it("renders the getting started heading", () => {
    render(<Home />);
    expect(screen.getByText("page.tsx")).toBeInTheDocument();
  });
});
