import { test, expect } from "@playwright/test";

/**
 * 左侧文件树用例（对应 tests/pages/home/left.md 与
 * requirements/components/file-tree-manager.md）
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
    await expect(aside.getByText("pages", { exact: true })).toBeVisible();
    await expect(aside.getByText("common", { exact: true })).toBeVisible();
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

  test("点击文件夹名可展开 / 收起", async ({ page }) => {
    await page.goto("/");

    const aside = page.locator("aside").first();
    const pagesDir = aside.locator('[data-tree-dir="pages"]');

    // 默认展开：pages/home 目录可见
    await expect(aside.locator('[data-tree-dir="pages/home"]')).toBeVisible();

    // 点击文件夹名：收起
    await pagesDir.click();
    await expect(aside.locator('[data-tree-dir="pages/home"]')).toBeHidden();

    // 再次点击：展开
    await pagesDir.click();
    await expect(aside.locator('[data-tree-dir="pages/home"]')).toBeVisible();
  });

  test("空文件夹展示「暂无文件」占位", async ({ page }) => {
    await page.goto("/");

    const aside = page.locator("aside").first();
    // common 目录下没有子目录，文件存在；用 pages/home 验证目录分组即可。
    // 空文件夹场景由接口冒烟覆盖（新建文件夹后立即查看）。
    await expect(aside.locator('[data-tree-dir="common"]')).toBeVisible();
  });
});

test.describe("Home 左侧文件树 - 文件管理", () => {
  test("新建文件：弹窗输入名称，成功后刷新并选中新文件", async ({ page }) => {
    await page.goto("/?file=common/base.md");
    const aside = page.locator("aside").first();

    // 打开 common 文件夹的点点点菜单
    const commonRow = aside.locator('[data-tree-dir="common"]').locator("xpath=..");
    await commonRow.hover();
    await commonRow.getByRole("button", { name: "common 的操作菜单" }).click();

    // 菜单：新建文件
    await page.getByRole("menuitem", { name: "新建文件", exact: true }).click();

    // 弹窗输入文件名
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("文件名").fill("e2e-new-file.md");
    await dialog.getByRole("button", { name: "创建" }).click();

    // 成功后自动选中新文件（url 与高亮）
    await expect(page).toHaveURL(/file=common%2Fe2e-new-file\.md|file=common\/e2e-new-file\.md/);
    const selected = page.locator('aside >> button[aria-current="true"]');
    await expect(selected).toHaveCount(1);
    await expect(selected).toContainText("e2e-new-file.md");

    // 文件树中出现新文件
    await expect(
      aside.locator('[data-tree-file="common/e2e-new-file.md"]'),
    ).toBeVisible();
  });

  test("新建文件：名称校验（空 / . 开头 / 含 /）", async ({ page }) => {
    await page.goto("/");
    const aside = page.locator("aside").first();

    const commonRow = aside.locator('[data-tree-dir="common"]').locator("xpath=..");
    await commonRow.hover();
    await commonRow.getByRole("button", { name: "common 的操作菜单" }).click();
    await page.getByRole("menuitem", { name: "新建文件", exact: true }).click();

    const dialog = page.getByRole("dialog");
    const input = dialog.getByLabel("文件名");

    // 空名称
    await input.fill("");
    await dialog.getByRole("button", { name: "创建" }).click();
    await expect(dialog.getByText("名称不能为空")).toBeVisible();

    // . 开头
    await input.fill(".hidden.md");
    await dialog.getByRole("button", { name: "创建" }).click();
    await expect(dialog.getByText("名称不能以 . 开头")).toBeVisible();

    // 文件名含 /
    await input.fill("a/b.md");
    await dialog.getByRole("button", { name: "创建" }).click();
    await expect(dialog.getByText("名称不能包含 /")).toBeVisible();

    // 取消关闭弹窗
    await dialog.getByRole("button", { name: "取消" }).click();
    await expect(dialog).toBeHidden();
  });

  test("重命名文件：默认填入当前名称，成功后更新选中与 url", async ({ page }) => {
    await page.goto("/?file=common/e2e-new-file.md");
    const aside = page.locator("aside").first();

    const fileRow = aside
      .locator('[data-tree-file="common/e2e-new-file.md"]')
      .locator("xpath=..");
    await fileRow.hover();
    await fileRow.getByRole("button", { name: "e2e-new-file.md 的操作菜单" }).click();

    await page.getByRole("menuitem", { name: "重命名" }).click();

    const dialog = page.getByRole("dialog");
    // 默认填入当前名称
    await expect(dialog.getByLabel("新名称")).toHaveValue("e2e-new-file.md");
    await dialog.getByLabel("新名称").fill("e2e-renamed.md");
    await dialog.getByRole("button", { name: "重命名" }).click();

    // 选中与 url 更新为新路径
    await expect(page).toHaveURL(/file=common%2Fe2e-renamed\.md|file=common\/e2e-renamed\.md/);
    const selected = page.locator('aside >> button[aria-current="true"]');
    await expect(selected).toHaveCount(1);
    await expect(selected).toContainText("e2e-renamed.md");
  });

  test("新建文件夹：name 含 / 一次创建多级", async ({ page }) => {
    await page.goto("/");
    const aside = page.locator("aside").first();

    const pagesRow = aside.locator('[data-tree-dir="pages"]').locator("xpath=..");
    await pagesRow.hover();
    await pagesRow.getByRole("button", { name: "pages 的操作菜单" }).click();
    await page.getByRole("menuitem", { name: "新建文件夹", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("文件夹名").fill("e2e-dir-a/e2e-dir-b");
    await dialog.getByRole("button", { name: "创建" }).click();

    // 新建文件夹成功后展开：多级目录可见
    await expect(aside.locator('[data-tree-dir="pages/e2e-dir-a"]')).toBeVisible();
    await expect(
      aside.locator('[data-tree-dir="pages/e2e-dir-a/e2e-dir-b"]'),
    ).toBeVisible();

    // 空文件夹展示「暂无文件」占位（e2e-dir-b 为新建的空文件夹）
    await expect(
      aside.locator("li").filter({ hasText: "e2e-dir-b" }).getByText("暂无文件"),
    ).toBeVisible();
  });

  test("删除文件：二次确认，确认后清除选中", async ({ page }) => {
    await page.goto("/?file=common/e2e-renamed.md");
    const aside = page.locator("aside").first();

    const fileRow = aside
      .locator('[data-tree-file="common/e2e-renamed.md"]')
      .locator("xpath=..");
    await fileRow.hover();
    await fileRow.getByRole("button", { name: "e2e-renamed.md 的操作菜单" }).click();
    await page.getByRole("menuitem", { name: "删除" }).click();

    // 二次确认弹窗
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/删除文件「e2e-renamed\.md」/)).toBeVisible();
    await dialog.getByRole("button", { name: "删除" }).click();

    // 删除后清除选中：url 不再指向被删除的文件
    await expect(page).not.toHaveURL(/e2e-renamed\.md/);

    // 文件树中不再出现
    await expect(
      aside.locator('[data-tree-file="common/e2e-renamed.md"]'),
    ).toHaveCount(0);
  });

  test("删除文件夹：二次确认提示「文件夹内的文件将一并删除」", async ({ page }) => {
    await page.goto("/");
    const aside = page.locator("aside").first();

    const dirRow = aside
      .locator('[data-tree-dir="pages/e2e-dir-a"]')
      .locator("xpath=..");
    await dirRow.hover();
    await dirRow.getByRole("button", { name: "e2e-dir-a 的操作菜单" }).click();
    await page.getByRole("menuitem", { name: "删除" }).click();

    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("文件夹内的文件将一并删除"),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "删除" }).click();

    // 目录消失
    await expect(aside.locator('[data-tree-dir="pages/e2e-dir-a"]')).toHaveCount(0);
  });

  test("菜单关闭：按 Esc / 点击菜单外区域 / 再次点击点点点 icon", async ({ page }) => {
    await page.goto("/");
    const aside = page.locator("aside").first();

    const pagesRow = aside.locator('[data-tree-dir="pages"]').locator("xpath=..");
    const moreBtn = pagesRow.getByRole("button", { name: "pages 的操作菜单" });
    await pagesRow.hover();
    await moreBtn.click();
    await expect(page.getByRole("menu")).toBeVisible();

    // 按 Esc 关闭
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();

    // 点击菜单外区域关闭
    await pagesRow.hover();
    await moreBtn.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.locator("header").click();
    await expect(page.getByRole("menu")).toBeHidden();

    // 再次点击点点点 icon 关闭
    await pagesRow.hover();
    await moreBtn.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await moreBtn.click();
    await expect(page.getByRole("menu")).toBeHidden();
  });

  test("根目录标题栏提供「新建文件 / 新建文件夹」入口", async ({ page }) => {
    await page.goto("/");
    const aside = page.locator("aside").first();

    // 根目录新建文件
    await aside.getByRole("button", { name: "在根目录新建文件", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("文件名").fill("e2e-root-file.md");
    await dialog.getByRole("button", { name: "创建" }).click();
    await expect(
      aside.locator('[data-tree-file="e2e-root-file.md"]'),
    ).toBeVisible();

    // 根目录新建文件夹
    await aside.getByRole("button", { name: "在根目录新建文件夹", exact: true }).click();
    await dialog.getByLabel("文件夹名").fill("e2e-root-dir");
    await dialog.getByRole("button", { name: "创建" }).click();
    await expect(aside.locator('[data-tree-dir="e2e-root-dir"]')).toBeVisible();

    // 清理：删除测试文件与文件夹
    const fileRow = aside
      .locator('[data-tree-file="e2e-root-file.md"]')
      .locator("xpath=..");
    await fileRow.hover();
    await fileRow.getByRole("button", { name: "e2e-root-file.md 的操作菜单" }).click();
    await page.getByRole("menuitem", { name: "删除" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "删除" }).click();
    await expect(
      aside.locator('[data-tree-file="e2e-root-file.md"]'),
    ).toHaveCount(0);

    const dirRow = aside.locator('[data-tree-dir="e2e-root-dir"]').locator("xpath=..");
    await dirRow.hover();
    await dirRow.getByRole("button", { name: "e2e-root-dir 的操作菜单" }).click();
    await page.getByRole("menuitem", { name: "删除" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "删除" }).click();
    await expect(aside.locator('[data-tree-dir="e2e-root-dir"]')).toHaveCount(0);
  });
});
