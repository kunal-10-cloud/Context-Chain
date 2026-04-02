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
