"use client";

import { Search } from "lucide-react";

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  ariaLabel,
  onSubmit,
  className = "",
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  accentColor?: string;
  /** Extra classes for the input, typically a height to match a row of buttons. */
  className?: string;
  /**
   * `search` announces the box as a searchbox and gives it the browser's own
   * clear control. The default stays `text` because several suites and the
   * skills page's search reach this control as a textbox.
   */
  type?: "text" | "search";
  /**
   * What this box searches. Defaults to "Search", which is honest for a
   * magnifier-and-field with no other context; a caller with something more
   * specific should say so (T-0083 / the form-control gate).
   */
  ariaLabel?: string;
  /**
   * Run the search on Enter. There is no form around this input, so there is
   * no implicit submit either: the Memory page printed "Press Enter to search"
   * under a box where Enter did nothing at all (T-0101, D60).
   */
  onSubmit?: () => void;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ps-text-muted" />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={
          onSubmit
            ? (e) => {
                if (e.key === "Enter") onSubmit();
              }
            : undefined
        }
        aria-label={ariaLabel ?? placeholder ?? "Search"}
        placeholder={placeholder}
        className={`w-full bg-ps-surface-panel border border-ps-edge rounded-ps-md pl-10 pr-4 py-2.5 text-body text-ps-text-primary placeholder-ps-text-muted transition-colors font-mono ${className}`}
      />
    </div>
  );
}
