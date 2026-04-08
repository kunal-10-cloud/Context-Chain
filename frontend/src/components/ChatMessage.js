import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User } from "lucide-react";

export default function ChatMessage({ message, modelInfo }) {
  const isUser = message.role === "user";

  return (
    <div
      data-testid={`message-${message.id}`}
      className={`flex items-start gap-3 p-3 transition-colors ${
        isUser ? "bg-zinc-50" : "bg-white border-l-2"
      }`}
      style={!isUser ? { borderLeftColor: modelInfo?.color || "#002FA7" } : {}}
    >
      {/* Avatar */}
      {isUser ? (
        <div className="w-7 h-7 bg-zinc-900 flex items-center justify-center text-white shrink-0">
          <User className="w-3.5 h-3.5" />
        </div>
      ) : (
        <div
          className="w-7 h-7 flex items-center justify-center text-white text-xs font-bold shrink-0"
          style={{ backgroundColor: modelInfo?.color || "#002FA7" }}
        >
          AI
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 text-sm leading-relaxed text-zinc-800">
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
