import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { X, Search, CheckCircle2, Code2, Building2, ListTodo, HelpCircle, Filter } from "lucide-react";

const TYPE_CONFIG = {
  decision: {
    icon: CheckCircle2,
    label: "Decision",
    bgClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  code: {
    icon: Code2,
    label: "Code",
    bgClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  architecture: {
    icon: Building2,
    label: "Architecture",
    bgClass: "bg-purple-50 text-purple-700 border-purple-200",
  },
  todo: {
    icon: ListTodo,
    label: "TODO",
    bgClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  question: {
    icon: HelpCircle,
    label: "Question",
    bgClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

export default function ContextPanel({ intelligence, sessions, onClose }) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState(null); // null = all

  const filtered = intelligence.filter(item => {
    if (activeFilter && item.type !== activeFilter) return false;
    if (search && !item.content.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const typeCounts = intelligence.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="w-80 bg-white border-l border-zinc-200 flex flex-col h-full" data-testid="context-panel">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
        <span className="label-caps" data-testid="context-panel-title">Intelligence</span>
        <button
          data-testid="close-context-panel-btn"
          onClick={onClose}
          className="p-1 hover:bg-zinc-100 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-zinc-500" />
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-zinc-200">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            data-testid="intelligence-search"
            type="text"
            placeholder="Search intelligence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-zinc-200 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-[#002FA7] transition-colors"
          />
        </div>
      </div>

      {/* Type Filters */}
      <div className="px-3 py-2 border-b border-zinc-200 flex items-center gap-1.5 flex-wrap">
        <button
          data-testid="filter-all"
          onClick={() => setActiveFilter(null)}
          className={`text-[10px] font-mono px-2 py-0.5 border transition-colors ${
            !activeFilter
              ? "border-[#002FA7] text-[#002FA7] bg-blue-50"
              : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
          }`}
        >
          ALL ({intelligence.length})
        </button>
        {Object.entries(TYPE_CONFIG).map(([type, config]) => (
          <button
            key={type}
            data-testid={`filter-${type}`}
            onClick={() => setActiveFilter(activeFilter === type ? null : type)}
            className={`text-[10px] font-mono px-2 py-0.5 border transition-colors ${
              activeFilter === type
                ? "border-[#002FA7] text-[#002FA7] bg-blue-50"
                : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
            }`}
          >
            {config.label.toUpperCase()} ({typeCounts[type] || 0})
          </button>
        ))}
      </div>

      {/* Intelligence Items */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2" data-testid="intelligence-list">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Filter className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
              <p className="text-xs text-zinc-400">
                {intelligence.length === 0
                  ? "No intelligence extracted yet. Chat with an AI and use 'Extract Insights'."
                  : "No items match your filter."
                }
              </p>
            </div>
          ) : (
            filtered.map(item => {
              const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.decision;
              const Icon = config.icon;
              return (
                <div
                  key={item.id}
                  data-testid={`intelligence-item-${item.id}`}
                  className="border border-zinc-200 p-3 hover:-translate-y-px hover:shadow-[2px_2px_0px_#002FA7] transition-all"
                >
                  <div className="flex items-start gap-2">
                    <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-zinc-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge
                          className={`text-[10px] font-mono px-1.5 py-0 rounded-none ${config.bgClass}`}
                        >
                          {config.label}
                        </Badge>
                        {item.session_title && (
                          <span className="font-mono text-[10px] text-zinc-400 truncate">
                            {item.session_title}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-700 leading-relaxed">
                        {item.content}
                      </p>
                      <span className="font-mono text-[9px] text-zinc-400 mt-1 block">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer Stats */}
      <div className="p-3 border-t border-zinc-200 bg-zinc-50">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-zinc-400">
            {filtered.length} items
          </span>
          <span className="font-mono text-[10px] text-zinc-400">
            {sessions.length} sessions
          </span>
        </div>
      </div>
    </div>
  );
}
