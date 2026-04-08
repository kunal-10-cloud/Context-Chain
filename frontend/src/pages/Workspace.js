import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import ChatArea from "@/components/ChatArea";
import ContextPanel from "@/components/ContextPanel";
import {
  fetchProjects, createProject, deleteProject,
  fetchSessions, createSession, deleteSession,
  fetchMessages, sendMessageStream,
  extractInsights, fetchIntelligence,
  getAvailableContext, injectContext,
} from "@/hooks/useApi";

const MODELS = [
  { key: "gpt-5.2", name: "GPT 5.2", provider: "OpenAI" },
  { key: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { key: "claude-sonnet-4.5", name: "Claude Sonnet 4.5", provider: "Anthropic" },
  { key: "claude-opus-4.5", name: "Claude Opus 4.5", provider: "Anthropic" },
  { key: "gemini-3-flash", name: "Gemini 3 Flash", provider: "Google" },
];

export default function Workspace() {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [openTabs, setOpenTabs] = useState([]); // [{sessionId, title, model}]
  const [activeTabId, setActiveTabId] = useState(null);
  const [messagesCache, setMessagesCache] = useState({});
  const [loadingChat, setLoadingChat] = useState(false);
  const [intelligence, setIntelligence] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [contextPanelOpen, setContextPanelOpen] = useState(true);
  const initRef = useRef(false);

  // Load projects on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await fetchProjects();
      setProjects(data);
      if (data.length > 0 && !activeProjectId) {
        setActiveProjectId(data[0].id);
      }
    } catch (e) {
      console.error("Failed to load projects:", e);
    }
  };

  // Load sessions when active project changes
  useEffect(() => {
    if (activeProjectId) {
      loadSessions(activeProjectId);
      loadIntelligence(activeProjectId);
    }
  }, [activeProjectId]);

  const loadSessions = async (projectId) => {
    try {
      const data = await fetchSessions(projectId);
      setSessions(data);
    } catch (e) {
      console.error("Failed to load sessions:", e);
    }
  };

  const loadIntelligence = async (projectId) => {
    try {
      const data = await fetchIntelligence({ project_id: projectId });
      setIntelligence(data);
    } catch (e) {
      console.error("Failed to load intelligence:", e);
    }
  };

  const handleCreateProject = async (name, description) => {
    try {
      const project = await createProject({ name, description });
      setProjects(prev => [project, ...prev]);
      setActiveProjectId(project.id);
      toast.success("Project created");
    } catch (e) {
      toast.error("Failed to create project");
    }
  };

  const handleDeleteProject = async (projectId) => {
    try {
      await deleteProject(projectId);
      setProjects(prev => prev.filter(p => p.id !== projectId));
      // Close tabs for this project's sessions
      const projectSessions = sessions.filter(s => s.project_id === projectId);
      const sessionIds = new Set(projectSessions.map(s => s.id));
      setOpenTabs(prev => prev.filter(t => !sessionIds.has(t.sessionId)));
      if (activeProjectId === projectId) {
        const remaining = projects.filter(p => p.id !== projectId);
        setActiveProjectId(remaining.length > 0 ? remaining[0].id : null);
      }
      toast.success("Project deleted");
    } catch (e) {
      toast.error("Failed to delete project");
    }
  };

  const handleCreateSession = async (model) => {
    if (!activeProjectId) {
      toast.error("Select or create a project first");
      return;
    }
    try {
      const modelInfo = MODELS.find(m => m.key === model);
      const title = `${modelInfo?.name || model} Session`;
      const session = await createSession({
        project_id: activeProjectId,
        title,
        model,
      });
      setSessions(prev => [session, ...prev]);
      openSessionTab(session);
      toast.success("Session created");
    } catch (e) {
      toast.error("Failed to create session");
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      closeTab(sessionId);
      toast.success("Session deleted");
    } catch (e) {
      toast.error("Failed to delete session");
    }
  };

  const openSessionTab = useCallback((session) => {
    setOpenTabs(prev => {
      const exists = prev.find(t => t.sessionId === session.id);
      if (exists) {
        setActiveTabId(session.id);
        return prev;
      }
      setActiveTabId(session.id);
      return [...prev, { sessionId: session.id, title: session.title, model: session.model }];
    });
    // Load messages if not cached
    if (!messagesCache[session.id]) {
      loadMessagesForSession(session.id);
    }
  }, [messagesCache]);

  const loadMessagesForSession = async (sessionId) => {
    try {
      const msgs = await fetchMessages(sessionId);
      setMessagesCache(prev => ({ ...prev, [sessionId]: msgs }));
    } catch (e) {
      console.error("Failed to load messages:", e);
    }
  };

  const closeTab = (sessionId) => {
    setOpenTabs(prev => {
      const newTabs = prev.filter(t => t.sessionId !== sessionId);
      if (activeTabId === sessionId) {
        setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].sessionId : null);
      }
      return newTabs;
    });
  };

  const streamControllerRef = useRef(null);

  const handleSendMessage = async (content) => {
    if (!activeTabId || loadingChat) return;

    const tab = openTabs.find(t => t.sessionId === activeTabId);
    if (!tab) return;

    const currentTabId = activeTabId;

    // Optimistic user message
    const userMsg = {
      id: `temp-${Date.now()}`,
      session_id: currentTabId,
      role: "user",
      content,
      model: tab.model,
      created_at: new Date().toISOString(),
    };

    // Placeholder assistant message for streaming
    const streamingMsgId = `streaming-${Date.now()}`;
    const streamingMsg = {
      id: streamingMsgId,
      session_id: currentTabId,
      role: "assistant",
      content: "",
      model: tab.model,
      created_at: new Date().toISOString(),
      isStreaming: true,
    };

    setMessagesCache(prev => ({
      ...prev,
      [currentTabId]: [...(prev[currentTabId] || []), userMsg, streamingMsg],
    }));

    setLoadingChat(true);
    let finalMessageId = null;

    streamControllerRef.current = sendMessageStream(
      currentTabId,
      content,
      // onChunk
      (chunk, messageId) => {
        if (messageId && !chunk) {
          // start event - store the real message ID
          finalMessageId = messageId;
          return;
        }
        setMessagesCache(prev => {
          const msgs = prev[currentTabId] || [];
          return {
            ...prev,
            [currentTabId]: msgs.map(m =>
              m.id === streamingMsgId
                ? { ...m, content: m.content + chunk }
                : m
            ),
          };
        });
      },
      // onDone
      (messageId) => {
        // Finalize: replace temp IDs with real ones and mark as not streaming
        setMessagesCache(prev => {
          const msgs = (prev[currentTabId] || []).map(m => {
            if (m.id === streamingMsgId) {
              return { ...m, id: messageId || finalMessageId || streamingMsgId, isStreaming: false };
            }
            if (m.id === userMsg.id) {
              return { ...m, id: m.id.replace('temp-', 'usr-') };
            }
            return m;
          });
          return { ...prev, [currentTabId]: msgs };
        });
        setLoadingChat(false);
        streamControllerRef.current = null;
      },
      // onError
      (errorMsg) => {
        toast.error(errorMsg || "Failed to send message");
        // Remove streaming message on error
        setMessagesCache(prev => ({
          ...prev,
          [currentTabId]: (prev[currentTabId] || []).filter(
            m => m.id !== streamingMsgId
          ),
        }));
        setLoadingChat(false);
        streamControllerRef.current = null;
      }
    );
  };

  const handleExtractInsights = async () => {
    if (!activeTabId) return;
    setExtracting(true);
    try {
      const data = await extractInsights(activeTabId);
      toast.success(`Extracted ${data.items.length} intelligence items`);
      if (activeProjectId) loadIntelligence(activeProjectId);
    } catch (e) {
      toast.error("Extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const handleInjectContext = async (sourceSessionIds) => {
    if (!activeTabId) return;
    try {
      await injectContext(activeTabId, sourceSessionIds);
      toast.success("Context injected into session");
    } catch (e) {
      toast.error("Failed to inject context");
    }
  };

  const activeProject = projects.find(p => p.id === activeProjectId);
  const activeMessages = messagesCache[activeTabId] || [];
  const activeTab = openTabs.find(t => t.sessionId === activeTabId);

  return (
    <div className="flex h-screen" data-testid="workspace-container">
      {/* Sidebar */}
      <Sidebar
        projects={projects}
        activeProjectId={activeProjectId}
        sessions={sessions}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onSelectProject={setActiveProjectId}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onSelectSession={openSessionTab}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteSession}
        models={MODELS}
      />

      {/* Chat Area - Center */}
      <div className="flex-1 flex flex-col min-w-0 border-x border-zinc-200">
        <ChatArea
          openTabs={openTabs}
          activeTabId={activeTabId}
          messages={activeMessages}
          loadingChat={loadingChat}
          extracting={extracting}
          activeTab={activeTab}
          onSelectTab={setActiveTabId}
          onCloseTab={closeTab}
          onSendMessage={handleSendMessage}
          onExtractInsights={handleExtractInsights}
          onCreateSession={handleCreateSession}
          onInjectContext={handleInjectContext}
          activeSessionId={activeTabId}
          models={MODELS}
          hasProject={!!activeProjectId}
        />
      </div>

      {/* Context Panel - Right */}
      {contextPanelOpen && (
        <ContextPanel
          intelligence={intelligence}
          sessions={sessions}
          onClose={() => setContextPanelOpen(false)}
        />
      )}

      {/* Toggle context panel button when closed */}
      {!contextPanelOpen && (
        <button
          data-testid="open-context-panel-btn"
          onClick={() => setContextPanelOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 bg-[#002FA7] text-white px-1.5 py-4 text-xs font-mono tracking-widest hover:bg-[#00227A] transition-colors"
          style={{ writingMode: 'vertical-lr' }}
        >
          CONTEXT
        </button>
      )}
    </div>
  );
}
