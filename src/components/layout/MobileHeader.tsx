"use client";
import { Menu, Terminal } from "lucide-react";
import Link from "next/link";
import { useSidebar } from "./SidebarContext";

export default function MobileHeader() {
  const { toggleMobile } = useSidebar();

  /* Compact mobile chrome (3rem): sidebar overlay entrypoint — intentionally shorter than desktop `--ch-shell-header-min-height` (5rem). */
  return (
    <div className="lg:hidden sticky top-0 z-50 flex items-center min-h-[var(--ch-mobile-header-min-height)] px-3 bg-dark-950/95 backdrop-blur-xl border-b border-white/10 flex-shrink-0 gap-3">
      <button
        onClick={toggleMobile}
        className="p-2 rounded-lg text-white/60 hover:text-white/80 hover:bg-white/5 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>
      <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <div className="w-7 h-7 rounded-lg animated-border p-[1.5px]">
          <div className="w-full h-full bg-dark-900 rounded-[5px] flex items-center justify-center">
            <Terminal className="w-4 h-4 text-neon-cyan" />
          </div>
        </div>
        <span className="text-sm font-bold tracking-tight">
          <span className="text-neon-cyan">PT</span>
          <span className="text-white/40 mx-0.5">/</span>
          <span className="text-white">Hermes</span>
        </span>
      </Link>
    </div>
  );
}
