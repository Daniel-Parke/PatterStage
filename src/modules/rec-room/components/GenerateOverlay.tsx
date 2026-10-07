"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, CheckCircle2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import { LOADING_MESSAGES } from "@/modules/rec-room/lib/prompts";

interface GenerateOverlayProps {
  title: string;
  visible: boolean;
  done: boolean;
  onComplete?: () => void;
  onStop?: () => void;
}

export default function GenerateOverlay({ title, visible, done, onComplete, onStop }: GenerateOverlayProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const completion = useRef(onComplete);
  useEffect(() => { completion.current = onComplete; }, [onComplete]);

  useEffect(() => {
    if (!visible) return;
    setMessageIndex(0);
    if (done) return;
    const interval = setInterval(() => setMessageIndex(index => (index + 1) % LOADING_MESSAGES.length), 5000);
    return () => clearInterval(interval);
  }, [visible, done]);

  useEffect(() => {
    if (!visible || !done) return;
    const timeout = setTimeout(() => completion.current?.(), 2000);
    return () => clearTimeout(timeout);
  }, [visible, done]);

  if (!visible) return null;

  const content = (
    <div role="status" aria-live="polite" aria-busy={!done} className="text-center">
      {done ? (
        <CheckCircle2 className="w-12 h-12 text-neon-green mx-auto mb-6" aria-hidden="true" />
      ) : (
        <Sparkles className="w-12 h-12 text-neon-purple animate-pulse mx-auto mb-6" aria-hidden="true" />
      )}
      <h2 className="text-title font-serif text-ps-text-primary mb-1">{title || "Your Story"}</h2>
      <p className={`text-body mb-6 ${done ? "text-neon-green" : "text-ps-text-muted"}`}>
        {done ? "Your story is ready!" : LOADING_MESSAGES[messageIndex]}
      </p>
      {!done && <p className="text-micro font-mono text-ps-text-faint">Waiting for confirmed results</p>}
    </div>
  );

  if (onStop && !done) {
    return (
      <Dialog open onClose={onStop} ariaLabel={`Writing ${title || "your story"}`} size="sm">
        {content}
        <div className="flex justify-center mt-4">
          <Button onClick={onStop}>Stop</Button>
        </div>
      </Dialog>
    );
  }

  return (
    // design-lint-disable-next-line overlay-uses-dialog-a11y -- no controls: create progress or the confirmed completion delay is a live status; cancellable work uses Dialog above
    <div className="fixed inset-0 z-overlay flex items-center justify-center bg-ps-surface-ground/90 backdrop-blur-sm">
      <Card padding="lg" className="mx-4 w-full max-w-md">{content}</Card>
    </div>
  );
}
