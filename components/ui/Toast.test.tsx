import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./Toast";
import { Button } from "./Button";

function Trigger({ variant, message }: { variant: "success" | "error"; message: string }) {
  const { showToast } = useToast();
  return <Button onClick={() => showToast(variant, message, 1000)}>trigger</Button>;
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("showToastを呼ぶとトーストが表示され、指定時間後に自動的に消える", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Trigger variant="success" message="保存しました" />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "trigger" }));
    expect(await screen.findByText("保存しました")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => expect(screen.queryByText("保存しました")).not.toBeInTheDocument());
  });

  it("Provider外でuseToastを呼ぶとエラーになる", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    function Bad() {
      useToast();
      return null;
    }
    expect(() => render(<Bad />)).toThrow("useToast must be used within a ToastProvider");
    consoleError.mockRestore();
  });
});
