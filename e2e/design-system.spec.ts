import { test, expect } from "@playwright/test";

test("design-system.mdのフォント・背景・文字色がページ全体(body)に適用される(T-032)", async ({
  page,
}) => {
  await page.goto("/login");

  const bodyStyles = await page.evaluate(() => {
    const style = getComputedStyle(document.body);
    return {
      fontFamily: style.fontFamily,
      backgroundColor: style.backgroundColor,
      color: style.color,
      lineHeight: style.lineHeight,
    };
  });

  expect(bodyStyles.fontFamily).toContain("-apple-system");
  expect(bodyStyles.backgroundColor).toBe("rgb(248, 249, 250)"); // gray-50
  expect(bodyStyles.color).toBe("rgb(33, 37, 41)"); // gray-900
  expect(bodyStyles.lineHeight).toBe("25.6px"); // 16px * 1.6
});
