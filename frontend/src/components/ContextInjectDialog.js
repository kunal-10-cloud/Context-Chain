import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { getAvailableContext } from "@/hooks/useApi";

export default function ContextInjectDialog({ open, onOpenChange, sessionId, onInject }) {
  const [availableSessions, setAvailableSessions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [injecting, setInjecting] = useState(false);

  useEffect(() => {
    if (open && sessionId) {
      loadAvailable();
    }
  }, [open, sessionId]);

  const loadAvailable = async () => {
    setLoading(true);
    try {
      const data = await getAvailableContext(sessionId);
      setAvailableSessions(data);
    } catch (e) {
      console.error("Failed to load available context:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSession = (sid) => {
    setSelectedIds(prev =>
      prev.includes(sid) ? prev.filter(id => id !== sid) : [...prev, sid]
    );
  };

  const handleInject = async () => {
    if (selectedIds.length === 0) return;
    setInjecting(true);
    try {
      await onInject(selectedIds);
      setSelectedIds([]);
      onOpenChange(false);
    } finally {
      setInjecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-sm max-w-md" data-testid="context-inject-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading font-bold">Load Context</DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            Select sessions to inject their extracted intelligence into this conversation.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
          </div>
        ) : availableSessions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-zinc-400">
              No sessions with extracted intelligence available.
              Use "Extract Insights" on other sessions first.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-64">
            <div className="space-y-2">
              {availableSessions.map(s => (
                <div
                  key={s.id}
                  data-testid={`context-session-${s.id}`}
                  className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${
                    selectedIds.includes(s.id)
                      ? "border-[#002FA7] bg-blue-50"
                      : "border-zinc-200 hover:border-zinc-300"
                  }`}
                  onClick={() => toggleSession(s.id)}
                >
                  <Checkbox
                    checked={selectedIds.includes(s.id)}
                    onCheckedChange={() => toggleSession(s.id)}
                    className="rounded-none"
                    data-testid={`context-checkbox-${s.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 truncate">{s.title}</p>
                    <p className="font-mono text-[10px] text-zinc-400">
                      {s.model} &middot; {s.intelligence_count} items &middot; {s.message_count} msgs
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-sm"
          >
            Cancel
          </Button>
          <Button
            data-testid="inject-context-submit-btn"
            onClick={handleInject}
            disabled={selectedIds.length === 0 || injecting}
            className="bg-[#002FA7] hover:bg-[#00227A] text-white rounded-sm"
          >
            {injecting ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : null}
            Inject {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
