import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Providers } from "./providers";

function Probe({ queryFn }: { queryFn: () => Promise<string> }) {
  const { data } = useQuery({ queryKey: ["probe"], queryFn });
  const queryClient = useQueryClient();
  return (
    <div>
      <div data-testid="probe">{data ?? "loading"}</div>
      <div data-testid="cached">{String(queryClient.getQueryData(["probe"]) ?? "")}</div>
    </div>
  );
}

describe("Providers", () => {
  it("useQueryの結果がQueryClientにキャッシュされる(T-024)", async () => {
    const queryFn = vi.fn().mockResolvedValue("result");

    render(
      <Providers>
        <Probe queryFn={queryFn} />
      </Providers>,
    );

    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("result"));
    expect(screen.getByTestId("cached")).toHaveTextContent("result");
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});
