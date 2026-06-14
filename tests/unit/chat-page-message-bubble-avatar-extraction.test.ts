/**
 * Source-pattern tests for the List 2 chat-surface refactor
 * (session 212). Two new components in src/components/chat/:
 *
 *   - MessageBubble.tsx — owns the per-message row (avatar + bubble
 *     + timestamp) previously inlined in chat/page.tsx's
 *     `messages.map` body
 *   - MessageAvatar.tsx — owns the round icon chip previously
 *     inlined in 3 sites:
 *       1. chat/page.tsx (assistant, left side)
 *       2. chat/page.tsx (user, right side)
 *       3. chat/TypingIndicator.tsx (assistant, with the typing dots)
 *
 * Why source-pattern:
 *   - Rendering the full chat page requires mocking useApiData,
 *     useToast, useGatewayHealth, the /api/orchestration/chat
 *     streaming endpoint, the localStorage session list, and the
 *     AbortController-based streaming lifecycle. The harness would
 *     dwarf the invariants being tested.
 *   - The refactor's "what changed" is structural (component
 *     extraction, removal of inlined 4-line avatar chips,
 *     removal of inlined 50-line message-bubble JSX), not
 *     behavioral. A pattern test pins the structural change at the
 *     source level — the same shape used by
 *     tests/unit/close-*-setter-callback.test.ts, the magic-string
 *     source-pattern tests, and the other chat refactor tests.
 *
 * What this test locks:
 *   1. Both new files exist with the expected exports
 *   2. The chat page imports MessageBubble from
 *      @/components/chat/MessageBubble
 *   3. The chat page no longer imports Bot or User from lucide-react
 *      (the icons moved to MessageAvatar; the page no longer renders
 *      them inline)
 *   4. The chat page no longer imports renderMarkdown from
 *      @/lib/chat-utils (the markdown render is encapsulated inside
 *      MessageBubble; the page no longer renders it inline)
 *   5. The 50-line inline `messages.map((msg) => ...)` body is
 *      replaced with the 1-line `<MessageBubble ... />` call
 *   6. The 2 inline "w-8 h-8 rounded-lg bg-neon-X/20" avatar chips
 *      in the chat page are removed (they now live in MessageAvatar)
 *   7. The TypingIndicator delegates the avatar to MessageAvatar
 *      (its inline 4-line chip is removed)
 *   8. The chat page's Bot+User imports are gone, but the TypingIndicator
 *      no longer imports them either (it now imports MessageAvatar)
 *   9. Anti-migration guard: `renderMarkdown` is still exported from
 *      @/lib/chat-utils (the test in chat-utils-sanitise-filename
 *      may transitively depend on it, and the TypingIndicator is
 *      a sentinel that the export must survive)
 */
import * as fs from "fs";
import * as path from "path";

const CHAT_PAGE_PATH = path.join(
  process.cwd(),
  "src/app/orchestration/chat/page.tsx",
);
const MESSAGE_BUBBLE_PATH = path.join(
  process.cwd(),
  "src/components/chat/MessageBubble.tsx",
);
const MESSAGE_AVATAR_PATH = path.join(
  process.cwd(),
  "src/components/chat/MessageAvatar.tsx",
);
const TYPING_INDICATOR_PATH = path.join(
  process.cwd(),
  "src/components/chat/TypingIndicator.tsx",
);
const CHAT_UTILS_PATH = path.join(
  process.cwd(),
  "src/lib/chat-utils.ts",
);

function read(relPath: string): string {
  return fs.readFileSync(relPath, "utf-8");
}

describe("ChatPage — MessageBubble + MessageAvatar extraction (session 212)", () => {
  describe("file existence + exports", () => {
    it("MessageBubble.tsx exists at src/components/chat/MessageBubble.tsx", () => {
      expect(fs.existsSync(MESSAGE_BUBBLE_PATH)).toBe(true);
      const src = read(MESSAGE_BUBBLE_PATH);
      // Default export of the React component
      expect(src).toMatch(/export\s+default\s+function\s+MessageBubble/);
    });

    it("MessageAvatar.tsx exists at src/components/chat/MessageAvatar.tsx with default export", () => {
      expect(fs.existsSync(MESSAGE_AVATAR_PATH)).toBe(true);
      const src = read(MESSAGE_AVATAR_PATH);
      expect(src).toMatch(/export\s+default\s+function\s+MessageAvatar/);
    });

    it("MessageAvatar exports the AVATAR_ROLE type", () => {
      const src = read(MESSAGE_AVATAR_PATH);
      expect(src).toMatch(/export\s+type\s+AVATAR_ROLE/);
    });
  });

  describe("chat page imports", () => {
    it("imports MessageBubble from @/components/chat/MessageBubble", () => {
      const src = read(CHAT_PAGE_PATH);
      expect(src).toMatch(
        /import\s+MessageBubble\s+from\s+"@\/components\/chat\/MessageBubble"/,
      );
    });

    it("does NOT import Bot or User from lucide-react (moved to MessageAvatar)", () => {
      const src = read(CHAT_PAGE_PATH);
      // The page no longer renders either icon directly.
      expect(src).not.toMatch(/\bBot\b.*from\s+"lucide-react"/);
      expect(src).not.toMatch(/\bUser\b.*from\s+"lucide-react"/);
    });

    it("does NOT import renderMarkdown from @/lib/chat-utils (encapsulated in MessageBubble)", () => {
      const src = read(CHAT_PAGE_PATH);
      // The page no longer needs renderMarkdown; the bubble component owns it.
      expect(src).not.toMatch(/renderMarkdown\s+from\s+"@\/lib\/chat-utils"/);
    });
  });

  describe("inline message-bubble JSX is replaced", () => {
    it("messages.map is the 1-line <MessageBubble ... /> form", () => {
      const src = read(CHAT_PAGE_PATH);
      // Pre-extraction: a 50-line JSX block inside the .map body.
      // Post-extraction: 1 line that maps to <MessageBubble key={...} msg={...} />.
      expect(src).toMatch(
        /messages\.map\(\(msg\)\s*=>\s*<MessageBubble\s+key=\{msg\.id\}\s+msg=\{msg\}\s*\/>/,
      );
    });

    it("does NOT contain the inline 50-line bubble JSX (max-w-[70%] switch on role)", () => {
      const src = read(CHAT_PAGE_PATH);
      // The pre-extraction form had the role-based bubble className switch
      // INSIDE the page JSX. After extraction, the page no longer renders
      // the "max-w-[70%] rounded-xl px-4 py-3 ... bg-neon-cyan/10 ... text-white/80"
      // bubble — that's MessageBubble's job.
      expect(src).not.toMatch(
        /max-w-\[70%\]\s+rounded-xl\s+px-4\s+py-3\s+bg-neon-cyan/,
      );
    });
  });

  describe("inline avatar chips in chat page are removed", () => {
    it("does NOT contain the inline assistant avatar chip (neon-purple/20)", () => {
      const src = read(CHAT_PAGE_PATH);
      // The pre-extraction form had the assistant avatar inline at
      // the start of the message row. After extraction, that's
      // MessageAvatar's job.
      expect(src).not.toMatch(
        /w-8 h-8 rounded-lg bg-neon-purple\/20 border border-neon-purple\/30/,
      );
    });

    it("does NOT contain the inline user avatar chip (neon-cyan/20)", () => {
      const src = read(CHAT_PAGE_PATH);
      // The pre-extraction form had the user avatar inline at the
      // end of the message row. After extraction, that's
      // MessageAvatar's job.
      expect(src).not.toMatch(
        /w-8 h-8 rounded-lg bg-neon-cyan\/20 border border-neon-cyan\/30/,
      );
    });
  });

  describe("TypingIndicator delegates to MessageAvatar", () => {
    it("TypingIndicator.tsx imports MessageAvatar from @/components/chat/MessageAvatar", () => {
      const src = read(TYPING_INDICATOR_PATH);
      expect(src).toMatch(
        /import\s+MessageAvatar\s+from\s+"@\/components\/chat\/MessageAvatar"/,
      );
    });

    it("TypingIndicator no longer imports Bot from lucide-react (moved to MessageAvatar)", () => {
      const src = read(TYPING_INDICATOR_PATH);
      // The pre-extraction form imported Bot directly. The
      // post-extraction form delegates the avatar to MessageAvatar.
      expect(src).not.toMatch(/\bBot\b.*from\s+"lucide-react"/);
    });

    it("TypingIndicator uses <MessageAvatar role='assistant' /> (no inline chip)", () => {
      const src = read(TYPING_INDICATOR_PATH);
      expect(src).toMatch(/<MessageAvatar\s+role="assistant"\s*\/>/);
    });

    it("TypingIndicator does NOT contain the inline assistant avatar chip", () => {
      const src = read(TYPING_INDICATOR_PATH);
      expect(src).not.toMatch(
        /w-8 h-8 rounded-lg bg-neon-purple\/20 border border-neon-purple\/30/,
      );
    });
  });

  describe("anti-migration guards (what this refactor did NOT change)", () => {
    it("renderMarkdown is still exported from @/lib/chat-utils", () => {
      // The export survives: MessageBubble imports it, and any
      // future "render a chat preview elsewhere" feature will need
      // it. Removing the export from chat-utils would break
      // MessageBubble.
      const src = read(CHAT_UTILS_PATH);
      expect(src).toMatch(/export\s+function\s+renderMarkdown/);
    });

    it("Bot and User icons are still imported somewhere in the chat surface (in MessageAvatar)", () => {
      // The icons moved from the chat page to MessageAvatar. They
      // are NOT gone — they're centralised. The page doesn't render
      // them, but the avatar component does.
      const src = read(MESSAGE_AVATAR_PATH);
      expect(src).toMatch(/\bBot\b/);
      expect(src).toMatch(/\bUser\b/);
    });

    it("TypingIndicator still renders the 3-dot bounce animation (not refactored away)", () => {
      const src = read(TYPING_INDICATOR_PATH);
      // The animation is the component's own concern; only the
      // avatar was extracted to MessageAvatar.
      expect(src).toMatch(/animate-bounce/);
      expect(src).toMatch(/animationDelay:\s*"0ms"/);
      expect(src).toMatch(/animationDelay:\s*"150ms"/);
      expect(src).toMatch(/animationDelay:\s*"300ms"/);
    });
  });
});
