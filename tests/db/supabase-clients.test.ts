import { describe, expect, it } from "vitest";
import { createSupabaseBrowserClient } from "../../lib/supabase-browser";

describe("createSupabaseBrowserClient", () => {
  it("ブラウザ側からセッションを取得できる(T-022)", async () => {
    const client = createSupabaseBrowserClient();
    const { data, error } = await client.auth.getSession();

    expect(error).toBeNull();
    expect(data.session).toBeNull(); // 未ログイン状態
  });
});
