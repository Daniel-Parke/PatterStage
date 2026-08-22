// ═══════════════════════════════════════════════════════════════
// useChatInput — the composer box, the mode toggle, the model picker
// ═══════════════════════════════════════════════════════════════
//
// Split out of useChatPage (Phase 4 god-file decomposition). Four
// pieces of local UI state with no wire calls between them: the draft
// text, the agent/fast mode, the selected model, and the textarea ref
// that gets focus after a new conversation opens.
//
// `setModel` is exposed because loading a conversation adopts the model
// it was created with; nothing else outside the picker writes it.

"use client";

import { useCallback, useRef, useState } from "react";

import { CHAT_DEFAULT_MODEL, CHAT_DEFAULT_MODE } from "@/types/chat";
import type { ChatMode } from "@/types/chat";

export function useChatInput() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ChatMode>(CHAT_DEFAULT_MODE);
  const [model, setModel] = useState(CHAT_DEFAULT_MODEL);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleModelChange = useCallback((next: string) => setModel(next), []);
  const handleModeChange = useCallback((next: ChatMode) => setMode(next), []);

  return {
    input,
    setInput,
    mode,
    model,
    setModel,
    inputRef,
    handleModelChange,
    handleModeChange,
  };
}
