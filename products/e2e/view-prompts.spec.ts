import { test, expect } from "@playwright/test";

/**
 * view-prompts 抽屉临时验证（requirements/components/view-prompts.md 变更）
 * - 抽屉打开后顶部有复制按钮
 * - 底部有补充内容输入框 + 发送任务按钮
 * - 发送任务调用 /api/agents/task 创建任务（拦截 fetch mock，避免真实建任务）
 */
test.describe("view-prompts 抽屉", () => {
  test("打开抽屉展示底部输入框并可发送任务", async ({ page }) => {
    await page.addInitScript(() => {
      const original = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        if (url.includes("/api/agents/task")) {
          // 记录请求体供断言
          (window as unknown as { __taskBody?: unknown }).__taskBody =
            JSON.parse(String(init?.body ?? "{}"));
          return new Response(JSON.stringify({ ok: true, sessionId: "test-session-1" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return original(input as RequestInfo, init as RequestInit);
      };
    });

    await page.goto("/?file=pages/home.md");

    // 点击「获取」打开抽屉
    const panel = page.locator("aside").last();
    await panel.getByRole("button", { name: "获取", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // 顶部操作栏：复制
    await expect(dialog.getByRole("button", { name: "复制", exact: true })).toBeVisible();

    // 底部输入框：补充内容（默认填上常用任务描述）+ 发送任务
    const supplement = dialog.getByLabel("补充内容");
    await expect(supplement).toBeVisible();
    await expect(supplement).toHaveValue("需求描述文件已更新，更新相关代码");
    await supplement.fill("补充：请关注底部输入框需求");

    await dialog.getByRole("button", { name: "发送任务", exact: true }).click();

    // 成功反馈
    await expect(dialog.getByText("任务已创建（test-session-1）")).toBeVisible();

    // 请求体包含 view-and-diff 内容 + 补充内容
    const body = (await page.evaluate(() =>
      (window as unknown as { __taskBody?: { prompt?: string } }).__taskBody,
    )) as { prompt?: string };
    expect(body?.prompt).toBeTruthy();
    expect(body?.prompt).toContain("补充：请关注底部输入框需求");
    expect(body?.prompt).toContain("<inject content=");

    // 关闭抽屉
    await dialog.getByRole("button", { name: "关闭" }).click();
    await expect(dialog).toBeHidden();
  });
});
