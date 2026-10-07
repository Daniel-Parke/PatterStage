// T0194 independent Faraday held coverage, 2026-10-04. T0191 owns the renderer.
// Synthetic read-only Chat fixture; the clipboard promise is the only held write.
import { test, expect } from "../helpers/route-contract-runtime";
import type { ChatConversation, ChatMessage } from "@/types/chat";

type ClipboardControl = { texts: string[]; complete?: () => void };
type ClipboardWindow = Window & { __t0194Clipboard: ClipboardControl };

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`T0194 Chat fenced copy ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    test("scoped CodeBlock Copy preserves literal payload and confirms only settled success", async ({ page, runtime }) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      const code = "  leading\n\n\t**literal** [link](https://example.test)\n<b>literal HTML</b> & trailing  \n";
      const content = `Outside code must not be copied.\n\n\`\`\`text\n${code}\`\`\`\n\n\`\`\`text\nDifferent block\n\`\`\``;
      const timestamp = "2026-10-04T12:00:00.000Z";
      const conversation: ChatConversation = { id: "t0194-code", title: "Owned code copy", model: "fixture",
        sessionId: null, profileName: null, previousResponseId: null, createdAt: timestamp, updatedAt: timestamp };
      const message: ChatMessage = { id: "t0194-code-message", conversationId: conversation.id, role: "assistant",
        content, reasoning: null, toolCalls: null, runId: null, status: "complete", error: null,
        createdAt: timestamp, updatedAt: timestamp };
      for (const [path, data] of [
        ["/api/chat", { conversations: [conversation] }],
        [`/api/chat/${conversation.id}`, { conversation, messages: [message] }],
        ["/api/gateway/health", { online: false, authConfigured: true }],
      ] as const) {
        await runtime.route(`**${path}`, async route => {
          expect(route.request().method()).toBe("GET");
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) });
        });
      }
      await page.addInitScript(() => {
        const control: ClipboardControl = { texts: [] };
        (window as unknown as ClipboardWindow).__t0194Clipboard = control;
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
          writeText: (text: string) => { control.texts.push(text); return new Promise<void>(resolve => { control.complete = resolve; }); },
        } });
      });
      await page.goto(`${runtime.origin}/work/chat`);
      await expect(page.getByRole("heading", { level: 1, name: "Chat", exact: true })).toHaveCount(1);
      const pre = page.locator("pre").filter({ hasText: "**literal**" });
      await expect(pre).toHaveCount(1);
      expect(await pre.textContent()).toBe(code);
      await expect(pre.locator("b, a, strong")).toHaveCount(0);
      const block = pre.locator("..");
      const copy = block.getByRole("button", { name: "Copy", exact: true });
      const other = page.locator("pre").filter({ hasText: "Different block" }).locator("..");
      await expect(other.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
      await copy.click();
      expect(await page.evaluate(() => (window as unknown as ClipboardWindow).__t0194Clipboard.texts)).toEqual([code]);
      await expect(copy).toHaveText("Copy");
      await expect(block.getByRole("button", { name: "Copied", exact: true })).toHaveCount(0);
      await page.evaluate(() => (window as unknown as ClipboardWindow).__t0194Clipboard.complete!());
      await expect(block.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
      await expect(other.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}
