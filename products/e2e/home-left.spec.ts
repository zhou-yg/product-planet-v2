import { test, expect } from "@playwright/test";

/**
 * 左侧文件树用例（对应 tests/pages/home/left.md）
 */
test.describe("Home 左侧文件树", () => {
  test("进入页面时展示 requirements 下的文件树", async ({ page }) => {
    await page.goto("/");

    // 文件树面板存在，且标注 requirements/
    const aside = page.locator("aside").first();
    await expect(aside).toBeVisible();
    await expect(aside.getByText("requirements/", { exact: true })).toBeVisible();

    // 真实内容库中的文件可见（目录分组渲染）
    await expect(aside.getByRole("button", { name: "home.md" })).toBeVisible();
    await expect(aside.getByText("pages/")).toBeVisible();
    await expect(aside.getByText("common/")).toBeVisible();
  });

  test("url 包含文件路径时高亮选中的文件", async ({ page }) => {
    await page.goto("/?file=common/base.md");

    const selected = page.locator('aside >> button[aria-current="true"]');
    await expect(selected).toHaveCount(1);
    await expect(selected).toContainText("base.md");
  });

  test("点击文件树中的文件时高亮并记录路径到 url", async ({ page }) => {
    await page.goto("/");

    await page.locator("aside").first().getByRole("button", { name: "base.md" }).click();

    // url 记录选中的文件路径
    await expect(page).toHaveURL(/file=common%2Fbase\.md|file=common\/base\.md/);

    // 高亮选中的文件
    const selected = page.locator('aside >> button[aria-current="true"]');
    await expect(selected).toHaveCount(1);
    await expect(selected).toContainText("base.md");
  });

  test("刷新页面时自动选中 url 中的文件", async ({ page }) => {
    await page.goto("/?file=pages/home.md");
    await page.reload();

    const selected = page.locator('aside >> button[aria-current="true"]');
    await expect(selected).toHaveCount(1);
    await expect(selected).toContainText("home.md");
  });
});
