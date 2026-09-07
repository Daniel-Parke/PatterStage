"use client";
import { Menu } from "lucide-react";
import Link from "next/link";
import { useSidebar } from "./SidebarContext";
import BrandMark from "./BrandMark";

export default function MobileHeader() {
  const { toggleMobile } = useSidebar();

  /* Compact mobile chrome (3rem): sidebar overlay entrypoint — intentionally
     shorter than desktop `--ps-shell-header-min-height` (5rem). Below md only:
     from 768 the rail is on the screen as the icon column and there is nothing
     for a hamburger to open (T-0128). */
  return (
    <div className="md:hidden sticky top-0 z-50 flex items-center min-h-[var(--ps-mobile-header-min-height)] px-3 bg-ps-surface-ground/95 backdrop-blur-xl border-b border-ps-edge-hairline flex-shrink-0 gap-3">
      <button
        onClick={toggleMobile}
        className="p-2 rounded-ps-md text-ps-text-secondary hover:text-ps-text-primary hover:bg-ps-surface-raised transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>
      {/* One mark, one name. This said "PT / Hermes": an abbreviation of the
          product beside the name of its dependency, so on a phone the product
          appeared to be called something else than it does on a desktop. */}
      {/* Named, because the words are gone: the compact lockup is the mark
          alone, and an icon-only link with no name is what D119 refuses. Same
          name the rail's own home link carries. */}
      <Link
        href="/"
        aria-label="PatterStage home"
        className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
      >
        <BrandMark size="bar" />
      </Link>
    </div>
  );
}
