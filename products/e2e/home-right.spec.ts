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

  test("底部「新增」按钮 + 文件树选择器：搜索、多选、确定后写入 inject", async ({ page, request }) => {
    // 准备：临时 md 文件（结束后删除，避免污染数据）
    const createRes = await request.post("/api/file/create", {
      data: { dir: "", name: "e2e-inject-picker.md" },
    });
    const created = (await createRes.json()) as { ok: boolean; path?: string };
    expect(created.ok).toBe(true);

    try {
      await page.goto("/?file=e2e-inject-picker.md");

      const panel = page.locator("aside").last();

      // 底部展示「新增」按钮（markdown 文件）
      const addButton = panel.getByRole("button", { name: "新增", exact: true });
      await expect(addButton).toBeVisible();
      await addButton.click();

      // 弹出文件树选择器
      const dialog = page.getByRole("dialog", { name: "新增 inject 依赖" });
      await expect(dialog).toBeVisible();

      // 排除当前文件自身
      await expect(
        dialog.getByLabel("e2e-inject-picker.md"),
      ).toHaveCount(0);

      // 前端搜索：按文件名过滤（搜索时只展示匹配项）
      await dialog.getByLabel("搜索文件").fill("base");
      await expect(dialog.getByLabel("common/base.md")).toBeVisible();
      await expect(dialog.getByLabel("pages/home.md")).toHaveCount(0);
      // 搜索时附带展示相对路径
      await expect(dialog.getByText("common/base.md")).toBeVisible();

      // 清空搜索恢复完整树（pages/home.md 重新可见）
      await dialog.getByLabel("搜索文件").fill("");
      await expect(dialog.getByLabel("pages/home.md")).toBeVisible();

      // 多选两个文件后确定
      await dialog.getByLabel("common/base.md").check();
      await dialog.getByLabel("pages/home.md").check();
      await dialog.getByRole("button", { name: "确定", exact: true }).click();

      // 弹窗关闭，依赖列表刷新，展示新增的依赖
      await expect(dialog).toBeHidden();
      await expect(panel.getByText("common/base.md")).toBeVisible();
      await expect(panel.getByText("pages/home.md")).toBeVisible();

      // 已添加的依赖不可再选：重新打开选择器
      await addButton.click();
      await expect(dialog).toBeVisible();
      await expect(
        dialog.locator("li").filter({ hasText: "base.md" }).getByText("已添加"),
      ).toBeVisible();
      await dialog.getByRole("button", { name: "取消", exact: true }).click();
      await expect(dialog).toBeHidden();
    } finally {
      // 清理：删除临时文件
      await request.post("/api/file/delete", {
        data: { path: "e2e-inject-picker.md" },
      });
    }
  });
});
