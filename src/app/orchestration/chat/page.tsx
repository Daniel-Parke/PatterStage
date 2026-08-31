// ═══════════════════════════════════════════════════════════════
// Chat Page — server-persisted agent chat.
//
// Conversations are backed by the server (mapped to Hermes sessions). In
// "Agent" mode a turn is a real run (tools + memory) streamed from the
// run-event SSE; in "Fast" mode it's a raw model reply. The stateful core
// lives in useChatPage; this file is the render shell.
// ═══════════════════════════════════════════════════════════════

"use client";

import { MessageCircle, Send, Plus, X, Download, Square, Check } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { timeAgo } from "@/lib/utils";
import TypingIndicator from "@/components/chat/TypingIndicator";
import GatewayBanner from "@/components/chat/GatewayBanner";
import MessageBubble from "@/components/chat/MessageBubble";
import { ChatModelSelector } from "@/components/chat/ChatModelSelector";
import { ChatModeToggle } from "@/components/chat/ChatModeToggle";
import ApprovalPrompt from "@/components/chat/ApprovalPrompt";
import { useChatPage } from "@/hooks/useChatPage";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";

export default function ChatPage() {
  const {
    toastElement,
    model,
    handleModelChange,
    registryModelIds,
    modelLabels,
    modelsLoading,
    modelsError,
    mode,
    handleModeChange,
    conversations,
    activeConversation,
    activeId,
    hasActiveConversation,
    handleSelectConversation,
    handleNewChat,
    handleDeleteConversation,
    handleDownloadConversation,
    gatewayUrl,
    bannerStates,
    messages,
    isStreaming,
    pendingApproval,
    handleApproval,
    messagesEndRef,
    inputRef,
    input,
    setInput,
    handleKeyDown,
    handleSend,
    handleStop,
  } = useChatPage();

  // Two-step confirm for the per-conversation delete (destructive — AGENTS.md
  // requires a confirmation). First click arms; second click within 3s deletes.
  const deleteConfirm = useTwoStepConfirm({ autoDismissMs: 3000 });

  const lastMessage = messages[messages.length - 1];
  const showTyping =
    isStreaming && lastMessage?.role === "assistant" && !lastMessage.content && !lastMessage.reasoning;

  return (
    <AppPageShell className="flex flex-col h-full min-h-0">
      <div className="flex flex-col flex-1 min-h-0">
        <PageHeader
          icon={MessageCircle}
          title="Chat"
          subtitle="Talk to your Hermes agent — tools, memory, live runs"
          color="cyan"
          actions={
            <div className="flex items-center gap-2">
              <ChatModeToggle mode={mode} onChange={handleModeChange} disabled={isStreaming} />
              {mode === "fast" && (
                <ChatModelSelector
                  model={model}
                  onChange={handleModelChange}
                  registryModelIds={registryModelIds}
                  modelLabels={modelLabels}
                  modelsLoading={modelsLoading}
                  modelsError={modelsError}
                />
              )}
              <Button variant="secondary" color="cyan" size="sm" icon={Plus} onClick={() => void handleNewChat()}>
                New Chat
              </Button>
            </div>
          }
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-60 shrink-0 border-r border-white/10 bg-white/[0.01] flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-mono text-ps-text-muted uppercase tracking-wider">
                Conversations ({conversations.length})
              </span>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {conversations.map((c) => (
                // The row is a CONTAINER, and the three controls inside it are
                // siblings. It used to be a <button> wrapping all three, with
                // the "as CSV" one nested three deep — invalid HTML, which the
                // browser recovers from by hoisting the inner controls out of
                // the outer button. The rendered tree then stops matching the
                // source: click targets, focus order and accessible names all
                // move somewhere the markup does not show, and a keyboard or
                // screen-reader user cannot reach them at all (T-0071).
                <div
                  key={c.id}
                  className={`w-full px-3 py-2 border-b border-white/5 transition-colors hover:bg-white/5 group relative ${
                    c.id === activeId ? "bg-white/10 border-l-2 border-l-neon-cyan" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => handleSelectConversation(c.id)}
                      className="min-w-0 flex-1 text-left"
                      title={c.title}
                      aria-current={c.id === activeId ? "true" : undefined}
                    >
                      <div className="text-xs text-ps-text-secondary truncate font-medium">{c.title}</div>
                      <div className="text-xs text-ps-text-muted mt-0.5 font-mono">{timeAgo(c.updatedAt)}</div>
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                      <div className="relative group/download">
                        <button
                          onClick={(e) => handleDownloadConversation(c, "json", e)}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-neon-cyan/20 hover:text-neon-cyan text-ps-text-muted"
                          title="Download as JSON"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <div className="absolute right-0 top-full mt-0.5 hidden group-hover/download:block z-50">
                          <button
                            onClick={(e) => handleDownloadConversation(c, "csv", e)}
                            className="whitespace-nowrap text-xs font-mono px-2 py-1 rounded bg-dark-900 border border-white/10 text-ps-text-secondary hover:text-white hover:bg-white/5 transition-colors shadow-lg"
                          >
                            as CSV
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (!deleteConfirm.isArmedFor(c.id)) deleteConfirm.arm(c.id);
                          else void deleteConfirm.confirm(() => handleDeleteConversation(c.id));
                        }}
                        className={`w-7 h-7 flex items-center justify-center rounded text-ps-text-muted ${
                          deleteConfirm.isArmedFor(c.id)
                            ? "bg-neon-red/20 text-neon-red"
                            : "hover:bg-neon-red/20 hover:text-neon-red"
                        }`}
                        title={deleteConfirm.isArmedFor(c.id) ? "Click again to confirm delete" : "Delete conversation"}
                      >
                        {deleteConfirm.isArmedFor(c.id) ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {conversations.length === 0 && (
                <div className="p-3 text-xs text-ps-text-faint italic">No conversations yet</div>
              )}
            </div>
          </div>

          {/* Main chat area */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {bannerStates.map((state) => (
                <GatewayBanner key={state} status={state} gatewayUrl={gatewayUrl} />
              ))}
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-24">
                  <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <MessageCircle className="w-8 h-8 text-ps-text-muted" />
                  </div>
                  {/* h2, not h3. PageHeader renders the page's only h1, and this
                      empty-state title is the next level down — a jump to h3
                      tells a screen-reader user there is a section they missed
                      (P0-3, found by a keyboard/heading-order pass). The size is
                      a class, not the tag. */}
                  <h2 className="text-lg font-semibold text-ps-text-secondary mb-1">
                    {hasActiveConversation ? activeConversation?.title || "New Chat" : "Chat with your agent"}
                  </h2>
                  <p className="text-sm text-ps-text-muted mb-2 max-w-md">
                    {mode === "agent"
                      ? "Agent mode: the assistant can use tools and remembers this conversation."
                      : "Fast mode: a quick raw-model reply with no tools."}
                  </p>
                </div>
              ) : (
                messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
              )}

              {showTyping && <TypingIndicator />}

              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="border-t border-white/10 px-6 py-4">
              {pendingApproval && (
                <ApprovalPrompt
                  toolName={pendingApproval.toolName}
                  onApprove={() => void handleApproval(true)}
                  onDeny={() => void handleApproval(false)}
                />
              )}
              <div className="flex items-end gap-2">
                <textarea aria-label="Message"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isStreaming
                      ? "Streaming… press Stop to interrupt"
                      : "Type a message… (Enter to send, Shift+Enter for newline)"
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
                  onClick={isStreaming ? () => void handleStop() : () => void handleSend()}
                  disabled={!input.trim() && !isStreaming}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors ${
                    isStreaming
                      ? "bg-neon-red/20 border-neon-red/30 text-neon-red hover:bg-neon-red/30"
                      : "bg-neon-cyan/20 border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed"
                  }`}
                  title={isStreaming ? "Stop" : "Send"}
                >
                  {isStreaming ? <Square className="w-4 h-4 fill-current" /> : <Send className="w-4 h-4" />}
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
