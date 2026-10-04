import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const HOME_MD = path.resolve(__dirname, "../../requirements/pages/home.md");
let originalHomeMd = "";

test.beforeAll(async () => {
  originalHomeMd = await fs.readFile(HOME_MD, "utf-8");
});

test.afterAll(async () => {
  // Restore the original file content so e2e tests never pollute requirements/
  await fs.writeFile(HOME_MD, originalHomeMd, "utf-8");
});

/**
 * 中间内容区用例（对应 tests/pages/home/middle.md）
 */
test.describe("Home 中间内容区", () => {
  test("选中文件时展示内容，标题取第一个 #，顶部不展示文件名", async ({ page }) => {
    await page.goto("/?file=common/base.md");

    // 标题输入框值为文档第一个 # 的文本
    const titleInput = page.getByRole("textbox", { name: "文档标题" });
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveValue("Base");

    // 顶部不展示文件名（header 与标题输入框中均无 base.md）
    await expect(page.locator("header")).not.toContainText("base.md");
    await expect(titleInput).not.toHaveValue(/base\.md/);

    // 正文可编辑（mdxeditor contenteditable 渲染）
    await expect(page.locator('[contenteditable="true"]').first()).toBeVisible();
  });

  test("编辑内容后点击保存按钮可保存成功", async ({ page }) => {
    // Use pages/home.md (restored in afterAll) to avoid polluting other files
    await page.goto("/?file=pages/home.md");

    // Edit the title input and save
    const titleInput = page.getByRole("textbox", { name: "文档标题" });
    await titleInput.fill("Home e2e-edit");

    // 点击保存按钮
    await page.getByRole("button", { name: "保存", exact: true }).click();

    // 保存成功反馈
    await expect(page.getByText("保存成功")).toBeVisible();
  });

  test("cmd + s 快捷键触发保存", async ({ page }) => {
    await page.goto("/?file=pages/home.md");

    const titleInput = page.getByRole("textbox", { name: "文档标题" });
    await titleInput.fill("Home e2e-cmd-s");

    // Cmd/Ctrl + S 触发保存
    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByText("保存成功")).toBeVisible();
  });

  test("保存时保留 meta 信息且标题与正文合并为文档", async ({ page, request }) => {
    // 选取一个带 frontmatter 的文件（pages/home.md 声明了 inject）
    await page.goto("/?file=pages/home.md");

    const titleInput = page.getByRole("textbox", { name: "文档标题" });
    await titleInput.fill("Home e2e-meta-keep");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText("保存成功")).toBeVisible();

    // 直接读取磁盘文件校验：frontmatter 保留、标题与正文合并为一个文档
    const saved = await fs.readFile(HOME_MD, "utf-8");
    expect(saved).toContain("inject:");
    expect(saved).toContain("# Home e2e-meta-keep");
    expect(saved).toContain("首页， 顶部标题栏 + 左中右");

    // 读接口返回内容（已剥离 frontmatter），包含合并后的标题与正文
    const res = await request.get("/api/file?path=pages/home.md");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { ok: boolean; doc?: { content: string } };
    expect(body.ok).toBeTruthy();
    expect(body.doc?.content).toContain("首页， 顶部标题栏 + 左中右");
  });
});
