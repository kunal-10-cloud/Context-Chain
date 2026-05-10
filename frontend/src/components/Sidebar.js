import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, FolderOpen, Trash2, MessageSquarePlus, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MODEL_COLORS = {
  "gpt-5.2": "bg-emerald-500",
  "gpt-4o": "bg-teal-500",
  "claude-sonnet-4.5": "bg-orange-500",
  "claude-opus-4.5": "bg-red-500",
  "gemini-3-flash": "bg-blue-500",
};

export default function Sidebar({
  projects, activeProjectId, sessions, collapsed,
  onToggleCollapse, onSelectProject, onCreateProject, onDeleteProject,
  onSelectSession, onCreateSession, onDeleteSession, onOpenMultiSession, models,
}) {
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newSessionModel, setNewSessionModel] = useState("gpt-5.2");

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    onCreateProject(newProjectName.trim(), newProjectDesc.trim());
    setNewProjectName("");
    setNewProjectDesc("");
    setShowNewProject(false);
  };

  if (collapsed) {
    return (
      <div className="w-12 bg-zinc-50 border-r border-zinc-200 flex flex-col items-center py-4 gap-4">
        <button
          data-testid="expand-sidebar-btn"
          onClick={onToggleCollapse}
          className="p-1.5 hover:bg-zinc-200 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-zinc-600" />
        </button>
        <button
          data-testid="collapsed-new-project-btn"
          onClick={() => setShowNewProject(true)}
          className="p-1.5 hover:bg-zinc-200 transition-colors"
        >
          <Plus className="w-4 h-4 text-zinc-600" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="w-64 bg-zinc-50 border-r border-zinc-200 flex flex-col h-full" data-testid="sidebar">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
          <h1 className="font-heading font-black text-lg tracking-tighter text-zinc-900" data-testid="app-title">
            Context Hub
          </h1>
          <button
            data-testid="collapse-sidebar-btn"
            onClick={onToggleCollapse}
            className="p-1 hover:bg-zinc-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Projects Section */}
        <div className="px-3 pt-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="label-caps" data-testid="projects-label">Projects</span>
            <button
              data-testid="new-project-btn"
              onClick={() => setShowNewProject(true)}
              className="p-1 hover:bg-zinc-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          </div>

          <ScrollArea className="max-h-40">
            {projects.length === 0 ? (
              <p className="text-xs text-zinc-400 px-2 py-3">No projects yet</p>
            ) : (
              projects.map(p => (
                <div
                  key={p.id}
                  data-testid={`project-item-${p.id}`}
                  className={`group flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors text-sm ${
                    activeProjectId === p.id
                      ? "bg-white border border-zinc-200 text-zinc-900 font-medium"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                  onClick={() => onSelectProject(p.id)}
                >
                  <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate flex-1">{p.name}</span>
                  <button
                    data-testid={`delete-project-${p.id}`}
                    onClick={(e) => { e.stopPropagation(); onDeleteProject(p.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-zinc-200 transition-all"
                  >
                    <Trash2 className="w-3 h-3 text-zinc-400" />
                  </button>
                </div>
              ))
            )}
          </ScrollArea>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-200 mx-3" />

        {/* Sessions Section */}
        <div className="px-3 pt-3 pb-2 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <span className="label-caps" data-testid="sessions-label">Sessions</span>
          </div>

          {/* New session controls */}
          <div className="flex gap-1.5 mb-3">
            <Select value={newSessionModel} onValueChange={setNewSessionModel}>
              <SelectTrigger
                className="h-7 text-xs rounded-sm flex-1"
                data-testid="new-session-model-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-sm">
                {models.map(m => (
                  <SelectItem key={m.key} value={m.key} className="text-xs">
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              data-testid="new-session-btn"
              onClick={() => onCreateSession(newSessionModel)}
              className="bg-[#002FA7] text-white px-2 h-7 text-xs font-medium hover:bg-[#00227A] transition-colors flex items-center gap-1"
              title="New single-agent session"
            >
              <MessageSquarePlus className="w-3 h-3" />
            </button>
          </div>
          <button
            data-testid="new-multi-agent-btn"
            onClick={onOpenMultiSession}
            className="w-full flex items-center gap-2 px-2 py-1.5 mb-2 border border-dashed border-zinc-300 text-xs text-zinc-500 hover:border-[#002FA7] hover:text-[#002FA7] transition-colors"
          >
            <Users className="w-3 h-3" />
            Multi-Agent Session
          </button>

          <ScrollArea className="flex-1">
            {sessions.length === 0 ? (
              <p className="text-xs text-zinc-400 px-2 py-3">No sessions yet</p>
            ) : (
              sessions.map(s => (
                <div
                  key={s.id}
                  data-testid={`session-item-${s.id}`}
                  className="group flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-zinc-100 transition-colors text-sm"
                  onClick={() => onSelectSession(s)}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${MODEL_COLORS[s.model] || "bg-zinc-400"}`} />
                  <span className="truncate flex-1 text-zinc-700">{s.title}</span>
                  {s.mode && s.mode !== "single" && (
                    <span className="font-mono text-[9px] text-[#002FA7] border border-[#002FA7] px-1 py-0 shrink-0">
                      {s.mode === "discussion" ? "DIS" : "PIP"}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-zinc-400 shrink-0">{s.message_count || 0}</span>
                  <button
                    data-testid={`delete-session-${s.id}`}
                    onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-zinc-200 transition-all"
                  >
                    <Trash2 className="w-3 h-3 text-zinc-400" />
                  </button>
                </div>
              ))
            )}
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-200">
          <p className="font-mono text-[10px] text-zinc-400">
            Persistent AI v1.0
          </p>
        </div>
      </div>

      {/* New Project Dialog */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent className="rounded-sm" data-testid="new-project-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold">New Project</DialogTitle>
            <DialogDescription className="text-sm text-zinc-500">
              Group your AI sessions under a project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              data-testid="new-project-name-input"
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="rounded-sm"
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
            />
            <Input
              data-testid="new-project-desc-input"
              placeholder="Description (optional)"
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              className="rounded-sm"
            />
          </div>
          <DialogFooter>
            <Button
              data-testid="create-project-submit-btn"
              onClick={handleCreateProject}
              className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-sm"
            >
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
