// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useClassOptions } from "../../hooks/useClassOptions";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useClassOptions", () => {
  it("クラス一覧取得+選択中クラスの生徒一覧取得をまとめて1つのフックとして提供する(T-024b)", async () => {
    const { result } = renderHook(() => useClassOptions(), { wrapper: createWrapper() });

    // 未ログイン状態(RLSにより空配列)でもエラーにならず両方のクエリが解決すること、
    // クラス選択の状態管理・生徒一覧取得の連動が1つのフックから提供されることを確認する
    expect(result.current.selectedClassId).toBeNull();
    expect(result.current.students).toEqual([]);

    await waitFor(() => expect(result.current.isLoadingClasses).toBe(false));
    expect(result.current.classes).toEqual([]);

    act(() => {
      result.current.setSelectedClassId("00000000-0000-0000-0000-000000000000");
    });

    await waitFor(() => expect(result.current.isLoadingStudents).toBe(false));
    expect(result.current.students).toEqual([]);
    expect(result.current.selectedClassId).toBe("00000000-0000-0000-0000-000000000000");
  });
});
