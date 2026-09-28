"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Button from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Input";
import { runWrite } from "@/lib/api/api-write";

interface BrowserSession {
  id: string;
  createdAtMs: number;
  lastActiveAtMs: number;
  absoluteExpiresAtMs: number;
}

function dateLabel(milliseconds: number): string {
  return new Date(milliseconds).toLocaleString();
}

export default function SessionManager() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [sessions, setSessions] = useState<BrowserSession[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const showMessage = (text: string) => setMessage(text);

  async function listSessions() {
    if (!token || busy) return;
    const supplied = token;
    setToken("");
    setMessage("");
    await runWrite<{ sessions: BrowserSession[] }>({
      setBusy,
      showToast: showMessage,
      url: "/api/auth/sessions/list",
      method: "POST",
      body: { token: supplied },
      successMessage: (data) => `${data.sessions.length} browser session${data.sessions.length === 1 ? "" : "s"} found.`,
      errorMessage: "Could not list browser sessions.",
      onSuccess: (data) => {
        if (!Array.isArray(data.sessions)) throw new Error("Session list was unavailable.");
        setSessions(data.sessions);
      },
    });
  }

  async function revokeSession(id: string) {
    if (!token || busy) {
      setMessage("Enter the operator token again to revoke a session.");
      return;
    }
    const supplied = token;
    setToken("");
    setMessage("");
    await runWrite({
      setBusy,
      showToast: showMessage,
      url: "/api/auth/sessions/revoke",
      method: "POST",
      body: { token: supplied, sessionId: id },
      successMessage: "Session revoked.",
      errorMessage: "Could not revoke session.",
      onSuccess: () => setSessions(current => current?.filter(session => session.id !== id) ?? null),
    });
  }

  async function signOut() {
    if (busy) return;
    await runWrite({
      setBusy,
      showToast: showMessage,
      url: "/api/auth/session",
      method: "DELETE",
      successMessage: "Signed out of this browser.",
      errorMessage: "Could not sign out.",
      onSuccess: () => { router.replace("/"); router.refresh(); },
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-body text-ps-text-secondary">
        Browser sessions end after 30 minutes without activity, after 12 hours, or when the server restarts.
        The operator token is required each time you list or revoke sessions.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <TextInput label="Operator token for session management" value={token} onChange={setToken} type="password" />
        </div>
        <Button onClick={() => void listSessions()} disabled={!token || busy} loading={busy}>List sessions</Button>
        <Button variant="secondary" onClick={() => void signOut()} disabled={busy}>Sign out this browser</Button>
      </div>
      <p aria-live="polite" className="text-body text-ps-text-secondary">{message}</p>
      {sessions && (
        sessions.length === 0 ? <p className="text-body text-ps-text-muted">No active browser sessions.</p> :
        <ul className="divide-y divide-ps-edge-hairline">
          {sessions.map(session => (
            <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 text-micro text-ps-text-secondary">
                <p className="font-mono break-all text-ps-text-primary">{session.id}</p>
                <p>Started {dateLabel(session.createdAtMs)} · Last active {dateLabel(session.lastActiveAtMs)}</p>
                <p>Expires {dateLabel(session.absoluteExpiresAtMs)}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => void revokeSession(session.id)} disabled={busy}
                aria-label={`Revoke session ${session.id}`}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
