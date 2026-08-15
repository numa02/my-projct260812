import { test, expect } from "@playwright/test";

test("未ログイン状態で保護された画面にアクセスするとログイン画面にリダイレクトされる(T-023)", async ({
  page,
}) => {
  await page.goto("/classes");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
});

test("未ログイン状態でもログイン画面自体にはリダイレクトされずアクセスできる(T-023)", async ({
  page,
}) => {
  const response = await page.goto("/login");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/login$/);
});
