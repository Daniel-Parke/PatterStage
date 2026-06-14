# Session 212 — List 2 (Cron, Missions, Chat) — MessageBubble + MessageAvatar extraction (50-line inline chat bubble JSX + 3 inline avatar chips)

**Date:** 2026-06-14
**Branch:** `mission/hermes-review-and-refactor`
**Random pick:** `echo $((RANDOM % 4 + 1))` = 2 (List 2: Cron, Missions, Chat). Last List 2 pick was session 210 (the `loadAndApplyTemplate` helper extraction in `useMissionsPage.ts`). The Chat surface had not been revisited since session 200+ — the chat page had grown to 658 lines with the largest inlined JSX block (the 50-line `messages.map` body).
**Status:** committed + pushed (commit `71c6b52`).

## What this refactor did

Extracted 2 new components from the chat surface — `MessageBubble` and `MessageAvatar` — that consolidate the per-message row + per-message avatar chip patterns.

## Extraction 1 — `MessageBubble` (`src/components/chat/MessageBubble.tsx`, new, 110 lines)

The chat page's 50-line `messages.map((msg) => ...)` body owned the per-message row inline: alignment div, conditional avatar, `max-w-[70%]` bubble with role-based colour, markdown render (or plain pre-wrap for user messages), HH:MM timestamp footer. All 50 lines moved into a single `<MessageBubble msg={msg} />` call at the call site. The component is pure (no internal state) — the chat page owns the streaming state and the `updateSessionMessages` callback.

**Pre-extraction form (chat page, lines 553-602, 50 lines):**

```tsx
messages.map((msg) => (
  <div
    key={msg.id}
    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
  >
    {msg.role === "assistant" && (
      <div className="w-8 h-8 rounded-lg bg-neon-purple/20 ...">
        <Bot className="w-4 h-4 text-neon-purple" />
      </div>
    )}
    <div className={`max-w-[70%] rounded-xl px-4 py-3 ${msg.role === "user" ? "..." : "..."}`}>
      {msg.role === "assistant" ? (
        <div className="text-sm leading-relaxed prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: msg.content ? renderMarkdown(msg.content) : '<span class="text-white/30 italic">Thinking...</span>' }}
        />
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
      )}
      <div className="text-[10px] text-white/20 font-mono mt-1 text-right">
        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
    {msg.role === "user" && (
      <div className="w-8 h-8 rounded-lg bg-neon-cyan/20 ...">
        <User className="w-4 h-4 text-neon-cyan" />
      </div>
    )}
  </div>
))
```

**Post-extraction form:**

```tsx
messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
```

## Extraction 2 — `MessageAvatar` (`src/components/chat/MessageAvatar.tsx`, new, 92 lines)

The 4-line `w-8 h-8 rounded-lg bg-neon-X/20 ...` icon chip appeared at **3 sites** with byte-identical outer markup, varying only in the icon (`Bot` vs `User`) and the colour token (`neon-purple` vs `neon-cyan`):

| # | Site | Role | Colour | Position |
|---|------|------|--------|----------|
| 1 | chat/page.tsx (assistant) | assistant | neon-purple | left of bubble |
| 2 | chat/page.tsx (user) | user | neon-cyan | right of bubble |
| 3 | TypingIndicator.tsx | assistant | neon-purple | left of dots |

The new component centralises the role → icon → colour mapping in a single `AVATARS: Record<AVATAR_ROLE, AvatarEntry>` map:

```tsx
const AVATARS: Record<AVATAR_ROLE, AvatarEntry> = {
  assistant: { Icon: Bot, iconClass: "text-neon-purple", bgClass: "bg-neon-purple/20", borderClass: "border-neon-purple/30" },
  user:      { Icon: User, iconClass: "text-neon-cyan",  bgClass: "bg-neon-cyan/20",  borderClass: "border-neon-cyan/30"  },
};
```

Caller passes a `role`; the helper resolves the icon and colour tokens. The `AVATAR_ROLE` type is exported so `MessageBubble` can use it as the union of valid `role` values (a future "system" or "tool" role forces a compile error in the AVATARS map, prompting the maintainer to add the entry — exhaustive type discipline).

## Anti-migration guards

**Sister site NOT a duplicate target:** `src/components/session/MessageBubble.tsx` renders session-transcript bubbles for the Sessions page. That component has very different semantics (expandable summary, role-coloured background, tool-call rendering, copy-with-feedback, `ROLE_META` icon metadata). The chat-page bubble is intentionally a different component. The shared elements are limited to "an icon chip on one side + a rounded card" — which the chat page now also uses `MessageAvatar` for.

**`TypingIndicator` is a separate concern.** The "Thinking..." placeholder inside `MessageBubble` is a string literal (`<span class="text-white/30 italic">Thinking...</span>`), not the `TypingIndicator` component. `TypingIndicator` is rendered below the message list, not as a message in it — moving it inside `MessageBubble` would conflate "render one message" with "show an in-flight animation". The chat-page render at line ~604 keeps the typing indicator outside the `.map` body.

**The 3-dot bounce animation stays inline in `TypingIndicator`.** It's a focused, 1-site use of a magic animation-delay sequence (`0ms` / `150ms` / `300ms`) that doesn't share structure with anything else in the chat surface.

## Tests

`tests/unit/chat-page-message-bubble-avatar-extraction.test.ts` (new, 17 assertions) covers:

- Both new files exist with expected exports (`MessageBubble` default, `MessageAvatar` default, `AVATAR_ROLE` type)
- Chat page imports `MessageBubble` from `@/components/chat/MessageBubble`
- Chat page no longer imports `Bot` or `User` from `lucide-react` (moved to `MessageAvatar`)
- Chat page no longer imports `renderMarkdown` from `@/lib/chat-utils` (encapsulated in `MessageBubble`)
- `messages.map` is the 1-line `<MessageBubble ... />` form
- Both inline avatar chips removed (assistant `neon-purple/20` and user `neon-cyan/20`)
- `TypingIndicator` delegates to `MessageAvatar` (`<MessageAvatar role="assistant" />`)
- `TypingIndicator` no longer imports `Bot` from `lucide-react`
- `TypingIndicator` does NOT contain the inline assistant avatar chip
- Anti-migration guards: `renderMarkdown` is still exported from `@/lib/chat-utils`, `Bot` and `User` icons are still imported somewhere in the chat surface (in `MessageAvatar`), `TypingIndicator` still renders the 3-dot bounce animation

Source-pattern style (no full-page render) — the chat page requires mocking `useApiData`, `useToast`, `useGatewayHealth`, the `/api/orchestration/chat` streaming endpoint, the localStorage session list, and the AbortController-based streaming lifecycle. The harness would dwarf the invariants being tested.

## Verification

- `npx tsc --noEmit`: clean
- `npx eslint . --max-warnings 0`: clean
- `npm run build`: clean
- `npm test`: **2550/2550 tests pass across 331 suites** (was 2550... pre-existing, +17 from the new test file)
- All pre-existing chat tests (`chat-page-active-session-reuse`, `chat-page-models-merge`, `chat-page-prepend-activate-session`, `chat-page-toast`, `chat-utils-sanitise-filename`, `copy-btn-magic-string-source-pattern`) still pass — 39/39 across 6 suites

## Files

- `src/app/orchestration/chat/page.tsx` — 658 → 610 lines (-48)
- `src/components/chat/MessageAvatar.tsx` — new, 92 lines
- `src/components/chat/MessageBubble.tsx` — new, 110 lines
- `src/components/chat/TypingIndicator.tsx` — 24 → 38 lines (+14, with JSDoc explaining what was extracted vs what stayed)
- `tests/unit/chat-page-message-bubble-avatar-extraction.test.ts` — new, 234 lines

Net: **+236 lines across new components** (with extensive JSDoc explaining extraction rationale) and **-48 lines from chat page**. The 50-line inline message JSX is gone; the 3 inline 4-line avatar chips are gone.

## Next session should

- **Random pick next session** — list rotation: List 1 last picked 211, List 2 last picked 212, List 3 last picked 209, List 4 last picked 210. The next pick should rotate, but the chat surface is now well-mined — the message-bubble and avatar patterns are extracted. The next List 2 pick should look OUTSIDE the chat page:
  - The cron page's `CronTabContent` has 2 prop groups (agent vs system) that could potentially collapse into a single component with a discriminated union — but the current shape (separate `isAgent` boolean + `onRun?` optional) is already a clean type-level discriminator, so the byte-equivalent gain is minimal.
  - The missions page's `vm` destructure in `missions/page.tsx` has ~50 fields; a future "group vm fields by concern" refactor (e.g. `vm.composer.*` + `vm.templates.*` + `vm.categories.*`) could improve readability but crosses the "byte-equivalent" line (props-vs-namespace).
- **Carryover** — closed. The chat-surface MessageBubble + MessageAvatar extraction was the only List 2 chat carryover.
