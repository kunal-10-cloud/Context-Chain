import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

// Projects
export const fetchProjects = () => api.get("/projects").then(r => r.data);
export const createProject = (data) => api.post("/projects", data).then(r => r.data);
export const updateProject = (id, data) => api.put(`/projects/${id}`, data).then(r => r.data);
export const deleteProject = (id) => api.delete(`/projects/${id}`).then(r => r.data);

// Sessions
export const fetchSessions = (projectId) =>
  api.get("/sessions", { params: { project_id: projectId } }).then(r => r.data);
export const createSession = (data) => api.post("/sessions", data).then(r => r.data);
export const getSession = (id) => api.get(`/sessions/${id}`).then(r => r.data);
export const updateSessionTitle = (id, title) =>
  api.put(`/sessions/${id}/title`, { title }).then(r => r.data);
export const deleteSession = (id) => api.delete(`/sessions/${id}`).then(r => r.data);

// Messages
export const fetchMessages = (sessionId) =>
  api.get(`/sessions/${sessionId}/messages`).then(r => r.data);

// Chat
export const sendMessage = (sessionId, content) =>
  api.post("/chat", { session_id: sessionId, content }).then(r => r.data);

// Chat Streaming (SSE)
export const sendMessageStream = (sessionId, content, onChunk, onDone, onError) => {
  const controller = new AbortController();

  fetch(`${API}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, content }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Stream failed" }));
        onError(err.detail || "Stream failed");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "chunk") {
                onChunk(event.content);
              } else if (event.type === "done") {
                onDone(event.message_id);
              } else if (event.type === "error") {
                onError(event.detail);
              } else if (event.type === "start") {
                onChunk("", event.message_id); // signal start with message_id
              }
            } catch (e) {
              // skip malformed events
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        onError(err.message || "Stream connection failed");
      }
    });

  return controller; // caller can abort
};

// Intelligence
export const extractInsights = (sessionId) =>
  api.post(`/sessions/${sessionId}/extract`).then(r => r.data);
export const fetchIntelligence = (params) =>
  api.get("/intelligence", { params }).then(r => r.data);

// Context
export const getAvailableContext = (sessionId) =>
  api.get(`/sessions/${sessionId}/available-context`).then(r => r.data);
export const injectContext = (sessionId, sessionIds) =>
  api.post(`/sessions/${sessionId}/inject-context`, { session_ids: sessionIds }).then(r => r.data);

// Models
export const fetchModels = () => api.get("/models").then(r => r.data);
