// GenerateOverlay — Loading overlay with smooth progress bar and fun messages
"use client";
import { useState, useEffect, useRef } from "react";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { LOADING_MESSAGES } from "@/modules/rec-room/lib/prompts";

interface GenerateOverlayProps {
  title: string;
  visible: boolean;
  done: boolean; // Parent signals when generation is complete
  onComplete?: () => void;
}

export default function GenerateOverlay({ title, visible, done, onComplete }: GenerateOverlayProps) {
  const [msg, setMsg] = useState(LOADING_MESSAGES[0]);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"generating" | "complete">("generating");
  const startTimeRef = useRef(0);
  const msgIndexRef = useRef(0);

  // Reset on visibility change
  useEffect(() => {
    if (visible) {
      setProgress(0);
      setPhase("generating");
      startTimeRef.current = Date.now();
      msgIndexRef.current = 0;
    }
  }, [visible]);

  // When parent signals done, snap to 100% and show success
  useEffect(() => {
    if (done && phase === "generating") {
      setProgress(100);
      setPhase("complete");
    }
  }, [done, phase]);

  // Message rotation — 5 seconds per message
  useEffect(() => {
    if (!visible || phase !== "generating") return;
    const interval = setInterval(() => {
      msgIndexRef.current = (msgIndexRef.current + 1) % LOADING_MESSAGES.length;
      setMsg(LOADING_MESSAGES[msgIndexRef.current]);
    }, 5000);
    return () => clearInterval(interval);
  }, [visible, phase]);

  // Smooth progress bar with ease-out curve — 90s to ~85%
  useEffect(() => {
    if (!visible || phase !== "generating") return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      // Ease-out curve: fast start, gradual slowdown
      // Reaches ~85% at 90 seconds
      const t = Math.min(elapsed / 90000, 1); // normalised 0-1 over 90s
      const eased = 1 - Math.pow(1 - t, 2.5); // ease-out
      const target = eased * 85;
      // Subtle noise to feel organic (±1.5%)
      const noise = (Math.random() - 0.5) * 3;
      setProgress((prev) => Math.min(90, Math.max(prev, target + noise)));
    }, 300);
    return () => clearInterval(interval);
  }, [visible, phase]);

  // After showing success for 2s, call onComplete to navigate
  useEffect(() => {
    if (phase === "complete" && onComplete) {
      const timeout = setTimeout(onComplete, 2000);
      return () => clearTimeout(timeout);
    }
  }, [phase, onComplete]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-950/90 backdrop-blur-sm">
      <div className="rounded-2xl border border-neon-purple/20 bg-dark-900/80 p-10 text-center max-w-md w-full mx-4">
        {phase === "generating" ? (
          <>
            <Sparkles className="w-12 h-12 text-neon-purple animate-pulse mx-auto mb-6" />
            <h2 className="text-xl font-serif text-white mb-1">{title || "Your Story"}</h2>
            <p className="text-sm text-ps-text-muted mb-6 h-5 transition-opacity">{msg}</p>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-12 h-12 text-neon-green mx-auto mb-6" />
            <h2 className="text-xl font-serif text-white mb-1">{title || "Your Story"}</h2>
            <p className="text-sm text-neon-green mb-6">Your story is ready!</p>
          </>
        )}

        {/* Progress bar */}
        <div className="w-full h-2.5 rounded-full bg-white/5 mb-6 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${
            phase === "complete" ? "bg-gradient-to-r from-semantic-success to-emerald-400" : "bg-gradient-to-r from-neon-purple to-neon-pink"
          }`} style={{ width: `${progress}%` }} />
        </div>

        <p className="text-xs font-mono text-ps-text-faint">{Math.round(progress)}%</p>
      </div>
    </div>
  );
}
