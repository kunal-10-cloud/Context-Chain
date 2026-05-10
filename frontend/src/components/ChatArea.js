import { useState, useRef, useEffect } from "react";
import { X, Plus, Sparkles, Link2, Send, Loader2, Users, ArrowRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import ChatMessage from "@/components/ChatMessage";
import ContextInjectDialog from "@/components/ContextInjectDialog";

const MODEL_INFO = {
  "gpt-5.2": { name: "GPT 5.2", provider: "OpenAI", color: "#10B981" },
  "gpt-4o": { name: "GPT-4o", provider: "OpenAI", color: "#14B8A6" },
  "claude-sonnet-4.5": { name: "Claude Sonnet 4.5", provider: "Anthropic", color: "#F97316" },
  "claude-opus-4.5": { name: "Claude Opus 4.5", provider: "Anthropic", color: "#EF4444" },
  "gemini-3-flash": { name: "Gemini 3 Flash", provider: "Google", color: "#3B82F6" },
};

export default function ChatArea({
  openTabs, activeTabId, messages, loadingChat, extracting, activeTab,
  onSelectTab, onCloseTab, onSendMessage, onExtractInsights,
  onCreateSession, onInjectContext, activeSessionId, models, hasProject,
}) {
  const [input, setInput] = useState("");
  const [showContextDialog, setShowContextDialog] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (activeTabId) inputRef.current?.focus();
  }, [activeTabId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || loadingChat) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e) => {
    // Enter sends, Shift+Enter = newline, Cmd/Ctrl+Enter also sends
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const modelInfo = activeTab ? MODEL_INFO[activeTab.model] : null;
  const isMultiAgent = activeTab && (activeTab.mode === "discussion" || activeTab.mode === "pipeline");

  // Empty state
  if (openTabs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8" data-testid="chat-empty-state">
        <div className="max-w-md text-center">
          <h2 className="font-heading font-black text-4xl sm:text-5xl tracking-tighter text-zinc-900 mb-4">
            Start a<br />conversation.
          </h2>
          <p className="text-sm text-zinc-500 mb-8 leading-relaxed">
            {hasProject
              ? "Select a session from the sidebar or create a new one to begin chatting with an AI model."
              : "Create a project first, then start a session with any AI model."
            }
          </p>
          {hasProject && (
            <div className="flex flex-wrap gap-2 justify-center">
              {models.map(m => (
                <button
                  key={m.key}
                  data-testid={`quick-create-${m.key}`}
                  onClick={() => onCreateSession(m.key)}
                  className="border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-[#002FA7] hover:text-[#002FA7] transition-colors"
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col h-full" data-testid="chat-area">
        {/* Tab Bar */}
        <div className="border-b border-zinc-200 bg-zinc-50 flex items-center overflow-x-auto" data-testid="tab-bar">
          {openTabs.map(tab => {
            const info = MODEL_INFO[tab.model];
            const isActive = tab.sessionId === activeTabId;
            return (
              <div
                key={tab.sessionId}
                data-testid={`tab-${tab.sessionId}`}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer border-r border-zinc-200 min-w-0 max-w-[180px] transition-colors ${
                  isActive
                    ? "bg-white border-t-2 border-t-[#002FA7] text-zinc-900 font-medium"
                    : "text-zinc-500 hover:bg-zinc-100 border-t-2 border-t-transparent"
                }`}
                onClick={() => onSelectTab(tab.sessionId)}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: info?.color || "#71717A" }}
                />
                <span className="truncate">{tab.title}</span>
                <button
                  data-testid={`close-tab-${tab.sessionId}`}
                  onClick={(e) => { e.stopPropagation(); onCloseTab(tab.sessionId); }}
                  className="shrink-0 p-0.5 hover:bg-zinc-200 transition-colors ml-auto"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-testid="new-tab-btn"
                onClick={() => onCreateSession("claude-sonnet-4.5")}
                className="px-3 py-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="rounded-sm text-xs">New session</TooltipContent>
          </Tooltip>
        </div>

        {/* Model Info Bar */}
        {activeTab && (
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 bg-white">
            <div className="flex items-center gap-2">
              {isMultiAgent ? (
                <>
                  <Users className="w-3.5 h-3.5 text-[#002FA7]" />
                  <span className="text-sm font-medium text-zinc-900" data-testid="active-model-name">
                    {activeTab.mode === "discussion" ? "Discussion" : "Pipeline"}
                  </span>
                  <div className="flex items-center gap-1 ml-1">
                    {(activeTab.agents || []).map((agentKey, i) => {
                      const info = MODEL_INFO[agentKey];
                      return (
                        <div key={agentKey} className="flex items-center gap-0.5">
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.5 text-white"
                            style={{ backgroundColor: info?.color || "#71717A" }}
                          >
                            {info?.name || agentKey}
                          </span>
                          {i < (activeTab.agents?.length || 0) - 1 && (
                            <ArrowRight className="w-2.5 h-2.5 text-zinc-400" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: modelInfo?.color }}
                  />
                  <span className="text-sm font-medium text-zinc-900" data-testid="active-model-name">
                    {modelInfo?.name}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400 border border-zinc-200 px-1.5 py-0.5">
                    {modelInfo?.provider}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-testid="inject-context-btn"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs rounded-sm border-zinc-200"
                    onClick={() => setShowContextDialog(true)}
                  >
                    <Link2 className="w-3 h-3 mr-1" />
                    Load Context
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="rounded-sm text-xs">
                  Inject context from other sessions
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-testid="extract-insights-btn"
                    size="sm"
                    className="h-7 text-xs rounded-sm bg-[#002FA7] hover:bg-[#00227A] text-white"
                    onClick={onExtractInsights}
                    disabled={extracting || messages.length === 0}
                  >
                    {extracting ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 mr-1" />
                    )}
                    Extract Insights
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="rounded-sm text-xs">
                  Extract decisions, code, TODOs from this session
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-1" data-testid="messages-container">
            {messages.length === 0 && !loadingChat ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div
                  className="w-16 h-16 mb-4 flex items-center justify-center border border-zinc-200"
                  style={{ backgroundColor: modelInfo?.color + "10" }}
                >
                  <span className="font-heading font-black text-xl" style={{ color: modelInfo?.color }}>
                    {modelInfo?.name?.charAt(0) || "?"}
                  </span>
                </div>
                <p className="text-sm text-zinc-500">
                  Start chatting with {modelInfo?.name || "the AI"}.
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Your conversation will be saved and can be analyzed for insights.
                </p>
              </div>
            ) : (
              messages.map(msg => (
                <ChatMessage key={msg.id} message={msg} modelInfo={MODEL_INFO[msg.model]} />
              ))
            )}
            {loadingChat && !messages.some(m => m.isStreaming && m.content) && (
              <div className="flex items-start gap-3 p-3" data-testid="loading-indicator">
                <div
                  className="w-7 h-7 flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: modelInfo?.color || "#71717A" }}
                >
                  AI
                </div>
                <div className="flex items-center gap-1.5 pt-2">
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-zinc-200 p-3 bg-white"
          data-testid="chat-input-form"
        >
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              data-testid="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${modelInfo?.name || "AI"}...  (Enter to send, Shift+Enter for newline)`}
              className="flex-1 border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#002FA7] transition-colors bg-white resize-none min-h-[38px] max-h-[120px]"
              disabled={loadingChat}
              rows={1}
              style={{ height: "auto", overflow: "hidden" }}
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
            />
            <button
              data-testid="send-message-btn"
              type="submit"
              disabled={loadingChat || !input.trim()}
              className="bg-[#002FA7] text-white px-4 py-2 text-sm font-medium hover:bg-[#00227A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 h-[38px]"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-1.5 px-0.5">
            <span className="font-mono text-[10px] text-zinc-400" data-testid="shortcut-hint-send">
              Enter to send
            </span>
            <span className="font-mono text-[10px] text-zinc-400" data-testid="shortcut-hint-newline">
              Shift+Enter newline
            </span>
            <span className="font-mono text-[10px] text-zinc-400" data-testid="shortcut-hint-new-session">
              {navigator.platform?.includes("Mac") ? "\u2318" : "Ctrl+"}N new session
            </span>
            <span className="font-mono text-[10px] text-zinc-400" data-testid="shortcut-hint-close-tab">
              {navigator.platform?.includes("Mac") ? "\u2318" : "Ctrl+"}W close tab
            </span>
          </div>
        </form>

        {/* Context Inject Dialog */}
        <ContextInjectDialog
          open={showContextDialog}
          onOpenChange={setShowContextDialog}
          sessionId={activeSessionId}
          onInject={onInjectContext}
        />
      </div>
    </TooltipProvider>
  );
}
