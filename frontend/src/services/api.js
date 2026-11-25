// One place that knows the backend URLs. Matches backend/app/main.py exactly.
import axios from "axios";
const baseURL = import.meta.env.VITE_API_URL || "";
const http = axios.create({ baseURL, timeout: 180000 });
const aiHttp = axios.create({ baseURL, timeout: 600000 });
const call = (p) => p.then((r) => r.data).catch((e) => { throw new Error(e.response?.data?.detail || e.message); });

export const api = {
  status: () => call(http.get("/api/status")),
  repos: () => call(http.get("/api/repos")),
  add: (url) => call(http.post("/api/repos", { url })),
  analysis: (id) => call(http.get(`/api/repos/${id}/analysis`)),
  summary: (id, mode) => call(aiHttp.get(`/api/repos/${id}/summary`, { params: { mode } })),
  architecture: (id) => call(http.get(`/api/repos/${id}/architecture`)),
  flow: (id, question) => call(http.post(`/api/repos/${id}/flow`, { question })),
  chat: (id, question, mode, engine) => call(aiHttp.post(`/api/repos/${id}/chat`, { question, mode, engine })),
  history: (id) => call(http.get(`/api/repos/${id}/chat`)),
};
