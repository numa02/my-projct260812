import { test, expect, type APIRequestContext } from "@playwright/test";

const MAILPIT_URL = "http://127.0.0.1:54324";

async function getLatestEmailLinkTo(request: APIRequestContext, toAddress: string): Promise<string> {
  let messageId: string | undefined;

  await expect(async () => {
    const res = await request.get(`${MAILPIT_URL}/api/v1/messages`);
    const body = await res.json();
    const message = (body.messages as Array<{ ID: string; To: Array<{ Address: string }> }>).find(
      (m) => m.To.some((to) => to.Address === toAddress),
    );
    expect(message).toBeTruthy();
    messageId = message!.ID;
  }).toPass({ timeout: 10_000 });

  const detailRes = await request.get(`${MAILPIT_URL}/api/v1/message/${messageId}`);
  const detail = await detailRes.json();
  const text: string = detail.Text ?? detail.HTML ?? "";
  const match = text.match(/http:\/\/127\.0\.0\.1:54321\/auth\/v1\/verify\?[^\s)]+/);
  if (!match) throw new Error(`verify link not found in email body: ${text}`);
  return match[0];
}

test.describe("認証フロー(T-049〜T-052)", () => {
  test("サインアップ→ログアウト→ログイン(誤ったパスワードはエラー)ができる", async ({ page }) => {
    const email = `e2e-${Date.now()}@example.com`;
    const password = "password123";

    await page.goto("/signup");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel("パスワード").fill(password);
    await page.getByRole("button", { name: "サインアップ" }).click();

    await expect(page).toHaveURL(/\/$/);

    // ログアウトしてログイン画面から誤ったパスワードでログイン
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel("パスワード").fill("wrong-password");
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(
      page.getByText("メールアドレスまたはパスワードが正しくありません"),
    ).toBeVisible();

    // 正しいパスワードでログイン
    await page.getByLabel("パスワード").fill(password);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("登録済みメールアドレスで再サインアップするとエラーになる", async ({ page }) => {
    const email = `e2e-dup-${Date.now()}@example.com`;
    const password = "password123";

    await page.goto("/signup");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel("パスワード").fill(password);
    await page.getByRole("button", { name: "サインアップ" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.context().clearCookies();
    await page.goto("/signup");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel("パスワード").fill(password);
    await page.getByRole("button", { name: "サインアップ" }).click();
    await expect(page.getByText("このメールアドレスは既に登録されています")).toBeVisible();
  });

  test("パスワードリセット申請は登録有無にかかわらず同一メッセージを表示する", async ({
    page,
  }) => {
    await page.goto("/reset-password");
    await page.getByLabel("メールアドレス").fill("not-registered@example.com");
    await page.getByRole("button", { name: "送信" }).click();
    await expect(page.getByText(/送信しました/)).toBeVisible();
  });

  test("パスワードリセットのメールリンクから新しいパスワードで再ログインできる", async ({
    page,
    request,
  }) => {
    const email = `e2e-reset-${Date.now()}@example.com`;
    const oldPassword = "password123";
    const newPassword = "newpassword456";

    await page.goto("/signup");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel("パスワード").fill(oldPassword);
    await page.getByRole("button", { name: "サインアップ" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.context().clearCookies();

    await page.goto("/reset-password");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByRole("button", { name: "送信" }).click();
    await expect(page.getByText(/送信しました/)).toBeVisible();

    const verifyLink = await getLatestEmailLinkTo(request, email);
    await page.goto(verifyLink);

    await expect(page).toHaveURL(/\/reset-password\/confirm/);
    await expect(page.getByRole("heading", { name: "新しいパスワードを設定" })).toBeVisible();

    await page.getByLabel("新しいパスワード", { exact: true }).fill(newPassword);
    await page.getByLabel("新しいパスワード(確認用)").fill(newPassword);
    await page.getByRole("button", { name: "パスワードを変更する" }).click();

    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel("パスワード").fill(newPassword);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
