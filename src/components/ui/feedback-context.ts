// ═══════════════════════════════════════════════════════════════
// feedback-context — the one place a page asks for a toast
//
// Owned by FeedbackProvider (src/components/providers/FeedbackProvider.tsx),
// mounted once in the root layout. useToast() reads it; when it is absent (a
// component rendered outside the shell, which today means a unit test) the
// hook falls back to its own single slot, so nothing is silently muted.
// Kept in its own module so Toast.tsx and the provider can both import it
// without importing each other.
// ═══════════════════════════════════════════════════════════════

"use client";

import { createContext } from "react";

import type { ToastType } from "./Toast";

export interface FeedbackContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

export const FeedbackContext = createContext<FeedbackContextValue | null>(null);
