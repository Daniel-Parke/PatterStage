// ChapterList — Chapter sidebar with pulsing status dots
"use client";

interface Chapter {
  number: number; title: string; status: string; wordCount: number;
  readStatus?: "writing" | "unread" | "read";
}

export default function ChapterList({ chapters, currentChapter, onSelect }: {
  chapters: Chapter[]; currentChapter: number; onSelect: (num: number) => void;
}) {
  const getStatusDot = (ch: Chapter) => {
    const rs = ch.readStatus || (ch.status === "writing" ? "writing" : ch.status === "complete" ? "unread" : "pending");

    if (rs === "writing" || ch.status === "writing") {
      return <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />;
    }
    if (rs === "read") {
      return <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-[pulse_3s_ease-in-out_infinite] flex-shrink-0" />;
    }
    if (rs === "unread" && ch.status === "complete") {
      return <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-[pulse_2s_ease-in-out_infinite] flex-shrink-0" />;
    }
    // pending
    return <span className="w-2.5 h-2.5 rounded-full bg-white/15 flex-shrink-0" />;
  };

  return (
    <div className="space-y-0.5">
      {chapters.map((ch) => {
        const canRead = ch.status === "complete";
        const isCurrent = ch.number === currentChapter;
        return (
          <button key={ch.number} onClick={() => canRead && onSelect(ch.number)}
            disabled={!canRead}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-left transition-all ${
              isCurrent ? "bg-neon-purple/10 border border-neon-purple/20" : "hover:bg-white/[0.03] border border-transparent"
            } ${!canRead ? "opacity-50 cursor-default" : "cursor-pointer"}`}>
            {/* Left: dot + title */}
            <div className="flex items-center gap-2.5 min-w-0">
              {getStatusDot(ch)}
              <div className="min-w-0">
                <div className={`text-xs truncate ${isCurrent ? "text-white" : "text-white/60"}`}>
                  {ch.title}
                </div>
                <div className="text-[9px] font-mono text-white/20">
                  {ch.status === "complete" ? `${ch.wordCount} words` : ch.status}
                </div>
              </div>
            </div>
            {/* Right: tick */}
            {ch.readStatus === "read" && (
              <span className="text-neon-green flex-shrink-0 text-xs">✓</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
