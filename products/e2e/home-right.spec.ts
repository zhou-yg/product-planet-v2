import { test, expect } from "@playwright/test";

/**
 * 右侧依赖区用例（对应 tests/pages/home/right.md）
 */
test.describe("Home 右侧依赖区", () => {
  test("markdown 且 meta 声明 inject 时展示依赖列表（仅名称和路径）", async ({ page }) => {
    await page.goto("/?file=pages/home.md");

    // 依赖面板
    const panel = page.locator("aside").last();
    await expect(panel).toBeVisible();
    await expect(panel.getByText("依赖", { exact: true })).toBeVisible();

    // pages/home.md 声明了 4 个 inject 依赖（pages/home/left|middle|right|top.md），均展示名称与路径
    await expect(panel.getByText("pages/home/left.md")).toBeVisible();
    await expect(panel.getByText("pages/home/middle.md")).toBeVisible();
    await expect(panel.getByText("pages/home/right.md")).toBeVisible();
    await expect(panel.getByText("pages/home/top.md")).toBeVisible();
  });

  test("markdown 但 meta 未声明 inject 时不展示依赖列表", async ({ page }) => {
    await page.goto("/?file=common/base.md");

    const panel = page.locator("aside").last();
    await expect(panel.getByText("当前文件未声明 inject 依赖")).toBeVisible();
  });

  test("点击「获取」按钮弹出弹框展示 view-and-diff 内容", async ({ page }) => {
    await page.goto("/?file=pages/home.md");

    const panel = page.locator("aside").last();
    await panel.getByRole("button", { name: "获取", exact: true }).click();

    // Dialog opens with view-and-diff content
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // File content
    await expect(dialog).toContainText("首页， 顶部标题栏 + 左中右");
    // Inject contents wrapped in <inject content="...">
    await expect(
      dialog,
    ).toContainText('<inject content="pages/home/left.md">');
    await expect(
      dialog,
    ).toContainText('<inject content="pages/home/right.md">');

    // 底部输入框：补充内容 + 发送任务（唤起 agents 工具）
    await expect(dialog.getByLabel("补充内容")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "发送任务", exact: true }),
    ).toBeVisible();

    // Close the dialog
    await dialog.getByRole("button", { name: "关闭" }).click();
    await expect(dialog).toBeHidden();
  });

  test("点击依赖项时跳转、文件树高亮并同步 url", async ({ page }) => {
    await page.goto("/?file=pages/home.md");

    const panel = page.locator("aside").last();
    await panel
      .getByRole("button", { name: /pages\/home\/right\.md/ })
      .click();

    // url 更新为依赖文件路径
    await expect(page).toHaveURL(
      /file=pages%2Fhome%2Fright\.md|file=pages\/home\/right\.md/,
    );

    // 文件树高亮跳转后的文件
    const selected = page.locator('aside >> button[aria-current="true"]');
    await expect(selected).toHaveCount(1);
    await expect(selected).toContainText("right.md");

    // 中间内容区切换为依赖文件
    await expect(page.getByRole("textbox", { name: "文档标题" })).toHaveValue(
      "Home - 右侧",
    );
  });
});
