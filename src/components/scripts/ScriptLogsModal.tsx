// ═══════════════════════════════════════════════════════════════
// ScriptLogsModal — the tail of a script's run log
//
// The fetch stays on the page; this renders the text it is handed.
// ═══════════════════════════════════════════════════════════════

"use client";

import { ScrollText } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function ScriptLogsModal({
  scriptName,
  text,
  loading,
  onClose,
}: {
  scriptName: string | null;
  text: string;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={scriptName !== null} onClose={onClose} title={scriptName ? `Logs · ${scriptName}` : "Logs"} icon={ScrollText} iconColor="text-neon-cyan" size="lg">
      {loading ? (
        <div className="py-8"><LoadingSpinner text="Loading log..." /></div>
      ) : (
        <pre className="max-h-[60vh] overflow-auto rounded-ps-md bg-ps-surface-inset p-4 font-mono text-micro text-ps-text-secondary whitespace-pre-wrap">
          {text || "(no log output yet — run the script first)"}
        </pre>
      )}
    </Modal>
  );
}
