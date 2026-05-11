import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User } from "lucide-react";

const MODEL_INFO = {
  "claude-opus-4.7": { name: "Claude Opus 4.7", color: "#DC2626" },
  "claude-sonnet-4.6": { name: "Claude Sonnet 4.6", color: "#EA580C" },
  "claude-opus-4.6": { name: "Claude Opus 4.6", color: "#E11D48" },
  "claude-sonnet-4.5": { name: "Claude Sonnet 4.5", color: "#F97316" },
  "claude-opus-4.5": { name: "Claude Opus 4.5", color: "#EF4444" },
  "claude-haiku-4.5": { name: "Claude Haiku 4.5", color: "#F59E0B" },
  "gpt-5.2": { name: "GPT 5.2", color: "#10B981" },
  "gpt-4o": { name: "GPT-4o", color: "#14B8A6" },
  "gemini-3-flash": { name: "Gemini 3 Flash", color: "#3B82F6" },
};

const STEP_LABELS = {
  1: "Lead",
  2: "Reviewer",
  3: "Synthesizer",
  4: "Specialist",
  5: "Advocate",
};

const PIPELINE_LABELS = {
  1: "Drafter",
  2: "Reviewer",
  3: "Finalizer",
  4: "QA",
  5: "Editor",
};

export default function ChatMessage({ message, modelInfo: passedModelInfo }) {
  const isUser = message.role === "user";
  const agentInfo = MODEL_INFO[message.model] || passedModelInfo;
  const hasStep = message.agent_step && message.agent_step > 0;

  return (
    <div
      data-testid={`message-${message.id}`}
      className={`flex items-start gap-3 p-3 transition-colors ${
        isUser ? "bg-zinc-50" : "bg-white border-l-2"
      }`}
      style={!isUser ? { borderLeftColor: agentInfo?.color || "#002FA7" } : {}}
    >
      {/* Avatar */}
      {isUser ? (
        <div className="w-7 h-7 bg-zinc-900 flex items-center justify-center text-white shrink-0">
          <User className="w-3.5 h-3.5" />
        </div>
      ) : (
        <div
          className="w-7 h-7 flex items-center justify-center text-white text-[10px] font-bold shrink-0"
          style={{ backgroundColor: agentInfo?.color || "#002FA7" }}
        >
          {hasStep ? message.agent_step : "AI"}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 text-sm leading-relaxed text-zinc-800">
        {/* Agent label for multi-agent messages */}
        {!isUser && agentInfo && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <span
              className="text-[10px] font-mono font-medium px-1.5 py-0.5 text-white"
              style={{ backgroundColor: agentInfo.color }}
              data-testid={`agent-badge-${message.id}`}
            >
              {agentInfo.name || message.model}
            </span>
            {hasStep && (
              <span className="text-[10px] font-mono text-zinc-400">
                Step {message.agent_step}
              </span>
            )}
          </div>
        )}

        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="chat-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
            {message.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-[#002FA7] ml-0.5 animate-pulse align-text-bottom" />
            )}
          </div>
        )}
        {!message.isStreaming && (
          <span className="font-mono text-[10px] text-zinc-400 mt-1.5 block">
            {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );
}
