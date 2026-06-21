"use client";

// ═══════════════════════════════════════════════════════════════
// motion/ — thin, reduced-motion-safe wrappers over `motion` (Framer
// Motion). Centralises the entrance/reveal/stagger micro-interactions so
// pages opt in consistently and `prefers-reduced-motion` is honoured in
// ONE place. Per 2026 dataviz guidance, these are interaction-level only —
// dense charts animate via their own SVG draw-in, not these wrappers.
// ═══════════════════════════════════════════════════════════════

import { motion, useReducedMotion, AnimatePresence } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/** `true` when the user prefers reduced motion (treat null as false). */
function useReducedMotionSafe(): boolean {
  return useReducedMotion() ?? false;
}

interface MotionBoxProps {
  children: ReactNode;
  className?: string;
  /** Stagger/sequence delay in seconds. */
  delay?: number;
  /** Initial vertical offset in px. */
  y?: number;
}

/** Fade + rise on mount. No-op (plain div) under reduced motion. */
export function FadeIn({ children, className, delay = 0, y = 8 }: MotionBoxProps) {
  const reduce = useReducedMotionSafe();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

/** Container that staggers its `StaggerItem` children in. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotionSafe();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={containerVariants} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

/** A single staggered child (use inside `Stagger`). */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotionSafe();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}

/** Animated height expand/collapse (e.g. the achievements showcase). */
export function Collapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  const reduce = useReducedMotionSafe();
  if (reduce) return open ? <div className={className}>{children}</div> : null;
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          className={className}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
