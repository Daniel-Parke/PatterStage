// ═══════════════════════════════════════════════════════════════
// AutoTextarea — Textarea that auto-scales to fit content
// ═══════════════════════════════════════════════════════════════

"use client";

import { useRef, useEffect, useCallback } from "react";
import { inputFieldClasses } from "@/lib/theme";

interface AutoTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /**
   * The accessible name. A placeholder is not one: it vanishes the moment the
   * box has content, which is exactly when somebody re-reading what they wrote
   * needs to know what they are writing (T-0083 / the form-control gate).
   */
  ariaLabel?: string;
  minRows?: number;
  maxRows?: number;
  className?: string;
  disabled?: boolean;
}

export default function AutoTextarea({
  value,
  onChange,
  placeholder = "",
  ariaLabel,
  minRows = 2,
  maxRows = 20,
  className = "",
  disabled = false,
}: AutoTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";

    // Calculate line height from computed style
    const computed = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(computed.lineHeight) || 20;

    const minHeight = minRows * lineHeight + 16; // +16 for padding
    const maxHeight = maxRows * lineHeight + 16;
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);

    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [minRows, maxRows]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      aria-label={ariaLabel ?? placeholder ?? undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      spellCheck={false}
      className={`${inputFieldClasses("cyan")} resize-none overflow-hidden transition-none ${className}`}
      style={{ height: "auto" }}
    />
  );
}
