import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageSquare, GitBranch, ArrowRight } from "lucide-react";

const MODELS = [
  { key: "claude-opus-4.7", name: "Claude Opus 4.7", provider: "Anthropic", color: "#DC2626" },
  { key: "claude-sonnet-4.6", name: "Claude Sonnet 4.6", provider: "Anthropic", color: "#EA580C" },
  { key: "claude-opus-4.6", name: "Claude Opus 4.6", provider: "Anthropic", color: "#E11D48" },
  { key: "claude-sonnet-4.5", name: "Claude Sonnet 4.5", provider: "Anthropic", color: "#F97316" },
  { key: "claude-opus-4.5", name: "Claude Opus 4.5", provider: "Anthropic", color: "#EF4444" },
  { key: "claude-haiku-4.5", name: "Claude Haiku 4.5", provider: "Anthropic", color: "#F59E0B" },
  { key: "gpt-5.2", name: "GPT 5.2", provider: "OpenAI", color: "#10B981" },
  { key: "gpt-4o", name: "GPT-4o", provider: "OpenAI", color: "#14B8A6" },
  { key: "gemini-3-flash", name: "Gemini 3 Flash", provider: "Google", color: "#3B82F6" },
];

const MODES = [
  {
    key: "discussion",
    label: "Discussion",
    desc: "Models discuss and critique each other's responses",
    icon: MessageSquare,
  },
  {
    key: "pipeline",
    label: "Pipeline",
    desc: "Output flows sequentially: draft, review, finalize",
    icon: ArrowRight,
  },
];

const DISCUSSION_LABELS = ["Lead Responder", "Reviewer", "Synthesizer", "Specialist", "Devil's Advocate"];
const PIPELINE_LABELS = ["Drafter", "Reviewer", "Finalizer", "Quality Checker", "Editor"];

export default function NewSessionDialog({ open, onOpenChange, onCreateSession }) {
  const [mode, setMode] = useState("discussion");
  const [selectedAgents, setSelectedAgents] = useState(["claude-opus-4.7", "claude-sonnet-4.6"]);
  const [title, setTitle] = useState("");

  const toggleAgent = (key) => {
    setSelectedAgents(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const moveAgent = (idx, dir) => {
    const next = [...selectedAgents];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= next.length) return;
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setSelectedAgents(next);
  };

  const handleCreate = () => {
    if (selectedAgents.length < 2) return;
    const labels = mode === "discussion" ? DISCUSSION_LABELS : PIPELINE_LABELS;
    const agentNames = selectedAgents.map((k, i) => {
      const m = MODELS.find(m => m.key === k);
      return m?.name || k;
    });
    const autoTitle = title.trim() || `${mode === "discussion" ? "Discussion" : "Pipeline"}: ${agentNames.join(" + ")}`;
    onCreateSession(mode, selectedAgents, autoTitle);
    onOpenChange(false);
    setTitle("");
  };

  const roleLabels = mode === "discussion" ? DISCUSSION_LABELS : PIPELINE_LABELS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-sm max-w-lg" data-testid="new-multi-session-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading font-bold">Multi-Agent Session</DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            Create a session where multiple AI models collaborate.
          </DialogDescription>
        </DialogHeader>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-2" data-testid="mode-selector">
          {MODES.map(m => {
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                data-testid={`mode-${m.key}`}
                onClick={() => setMode(m.key)}
                className={`flex flex-col items-start p-3 border text-left transition-all ${
                  mode === m.key
                    ? "border-[#002FA7] bg-blue-50 shadow-[2px_2px_0px_#002FA7]"
                    : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{m.label}</span>
                </div>
                <span className="text-[11px] text-zinc-500 leading-tight">{m.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Title */}
        <Input
          data-testid="multi-session-title"
          placeholder="Session title (auto-generated if empty)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-sm"
        />

        {/* Agent Selector */}
        <div>
          <span className="label-caps mb-2 block">Select Agents (min 2, order matters)</span>
          <div className="space-y-1.5">
            {MODELS.map(m => {
              const isSelected = selectedAgents.includes(m.key);
              const idx = selectedAgents.indexOf(m.key);
              return (
                <div
                  key={m.key}
                  data-testid={`agent-option-${m.key}`}
                  className={`flex items-center gap-3 p-2 border cursor-pointer transition-all ${
                    isSelected
                      ? "border-[#002FA7] bg-blue-50"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                  onClick={() => toggleAgent(m.key)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleAgent(m.key)}
                    className="rounded-none"
                    data-testid={`agent-check-${m.key}`}
                  />
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: m.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{m.name}</span>
                    <span className="text-[10px] text-zinc-400 ml-2">{m.provider}</span>
                  </div>
                  {isSelected && (
                    <span className="font-mono text-[10px] text-[#002FA7] border border-[#002FA7] px-1.5 py-0.5 shrink-0">
                      {roleLabels[idx] || `Step ${idx + 1}`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected order preview */}
        {selectedAgents.length >= 2 && (
          <div className="border border-zinc-200 p-3 bg-zinc-50">
            <span className="label-caps mb-2 block">
              {mode === "discussion" ? "Discussion Order" : "Pipeline Flow"}
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {selectedAgents.map((key, i) => {
                const m = MODELS.find(x => x.key === key);
                return (
                  <div key={key} className="flex items-center gap-1">
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 text-white"
                      style={{ backgroundColor: m?.color || "#71717A" }}
                      data-testid={`agent-order-${i}`}
                    >
                      {m?.name}
                    </span>
                    {i < selectedAgents.length - 1 && (
                      <ArrowRight className="w-3 h-3 text-zinc-400" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-sm">
            Cancel
          </Button>
          <Button
            data-testid="create-multi-session-btn"
            onClick={handleCreate}
            disabled={selectedAgents.length < 2}
            className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-sm"
          >
            Create {mode === "discussion" ? "Discussion" : "Pipeline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
