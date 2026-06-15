// ═══════════════════════════════════════════════════════════════
// Chat Page — Web-based Hermes agent chat interface
// ═══════════════════════════════════════════════════════════════
// Streaming LLM responses via Hermes Gateway API Server.
// Supports: localStorage session persistence, session deletion,
// streaming, markdown rendering, code block copy, model selector.
// The stateful core (sessions + streaming) lives in useChatPage; this
// file is the render shell.
// ═══════════════════════════════════════════════════════════════

"use client";

import { MessageCircle, Send, Plus, X, Download, Square } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { pluralise } from "@/lib/utils";
import TypingIndicator from "@/components/chat/TypingIndicator";
import GatewayBanner from "@/components/chat/GatewayBanner";
import MessageBubble from "@/components/chat/MessageBubble";
import { ChatModelSelector } from "@/components/chat/ChatModelSelector";
import { useChatPage } from "@/hooks/useChatPage";

// ── Page component ─────────────────────────────────────────────

export default function ChatPage() {
  const {
    toastElement,
    model,
    handleModelChange,
    registryModelIds,
    modelLabels,
    modelsLoading,
    modelsError,
    sessionList,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    hasActiveSession,
    handleNewChat,
    handleDeleteSession,
    handleDownloadSession,
    gatewayOnline,
    gatewayAuthConfigured,
    agentDefaultModelSet,
    messages,
    isStreaming,
    messagesEndRef,
    inputRef,
    input,
    setInput,
    handleKeyDown,
    handleSend,
    abortControllerRef,
  } = useChatPage();

  // ── Render ─────────────────────────────────────────────────
  return (
    <AppPageShell className="flex flex-col h-full min-h-0">
      <div className="flex flex-col flex-1 min-h-0">
      <PageHeader
        icon={MessageCircle}
        title="Chat"
        subtitle="Web-based Hermes agent interface"
        color="cyan"
        actions={
          <div className="flex items-center gap-2">
            <ChatModelSelector
              model={model}
              onChange={handleModelChange}
              registryModelIds={registryModelIds}
              modelLabels={modelLabels}
              modelsLoading={modelsLoading}
              modelsError={modelsError}
            />
            <Button
              variant="secondary"
              color="cyan"
              size="sm"
              icon={Plus}
              onClick={handleNewChat}
            >
              New Chat
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — only visible when there are sessions to show */}
        <div className="w-60 shrink-0 border-r border-white/10 bg-white/[0.01] flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
              Sessions ({sessionList.length})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {sessionList.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSessionId(s.id)}
                className={`w-full text-left px-3 py-2 border-b border-white/5 transition-colors hover:bg-white/5 group relative ${
                  s.id === activeSessionId ? "bg-white/10 border-l-2 border-l-neon-cyan" : ""
                }`}
                title={s.title}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white/70 truncate font-medium">
                      {s.title}
                    </div>
                    <div className="text-[10px] text-white/30 mt-0.5 font-mono">
                      {s.messages.length} message{pluralise(s.messages.length)}
                    </div>
                  </div>
                  {/* Hover actions: download + delete */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <div className="relative group/download">
                      <button
                        onClick={(e) => handleDownloadSession(s, "json", e)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-neon-cyan/20 hover:text-neon-cyan text-white/30"
                        title="Download as JSON"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <div className="absolute right-0 top-full mt-0.5 hidden group-hover/download:block z-50">
                        <button
                          onClick={(e) => handleDownloadSession(s, "csv", e)}
                          className="whitespace-nowrap text-[10px] font-mono px-2 py-1 rounded bg-dark-900 border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors shadow-lg"
                        >
                          as CSV
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-neon-red/20 hover:text-neon-red text-white/30"
                      title="Delete session"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </button>
            ))}
            {sessionList.length === 0 && (
              <div className="p-3 text-xs text-white/20 italic">No sessions</div>
            )}
          </div>
        </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Gateway status banners — shown regardless of session state */}
            {!hasActiveSession && messages.length === 0 && (
              <>
                {gatewayOnline === false && <GatewayBanner status="offline" />}
                {gatewayOnline === true && gatewayAuthConfigured === false && (
                  <GatewayBanner status="auth-missing" />
                )}
                {gatewayOnline !== false &&
                  gatewayAuthConfigured !== false &&
                  agentDefaultModelSet === false && (
                    <GatewayBanner status="model-missing" />
                  )}
                {gatewayOnline === null && <GatewayBanner status="checking" />}
              </>
            )}
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-24">
                <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-white/30" />
                </div>
                <h3 className="text-lg font-semibold text-white/60 mb-1">
                  {hasActiveSession
                    ? activeSession?.title || "New Chat"
                    : "Chat with your agent"}
                </h3>
                <p className="text-sm text-white/40 mb-2 max-w-md">
                  {hasActiveSession
                    ? "Send a message to begin."
                    : "Type a message below to start a new conversation."}
                </p>
                {!hasActiveSession && gatewayOnline !== false && (
                  <p className="text-xs text-white/20 font-mono">
                    Connected via Gateway API Server at localhost:8642
                  </p>
                )}
              </div>
            ) : (
              messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
            )}

            {isStreaming && messages.length > 0 && !messages[messages.length - 1].content && (
              <TypingIndicator />
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area — always visible */}
          <div className="border-t border-white/10 px-6 py-4">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isStreaming
                    ? "Type to interrupt and send a new message..."
                    : hasActiveSession
                    ? "Type a message... (Enter to send, Shift+Enter for newline)"
                    : "Type a message to start a new conversation..."
                }
                rows={1}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-neon-cyan/50 transition-colors font-mono resize-none"
                style={{ minHeight: "42px", maxHeight: "120px" }}
                onInput={(e) => {
                  const ta = e.target as HTMLTextAreaElement;
                  ta.style.height = "auto";
                  ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
                }}
              />
              <button
                onClick={isStreaming ? () => abortControllerRef.current?.abort() : handleSend}
                disabled={!input.trim() && !isStreaming}
                className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${
                  isStreaming
                    ? "bg-neon-red/20 border-neon-red/30 text-neon-red hover:bg-neon-red/30"
                    : "bg-neon-cyan/20 border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed"
                }`}
              >
                {isStreaming ? (
                  <Square className="w-4 h-4 fill-current" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
      {toastElement}
    </AppPageShell>
  );
}
