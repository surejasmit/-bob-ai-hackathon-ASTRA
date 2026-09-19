import {
  DashboardSummary,
  CongestionData,
  Vessel,
  Berth,
  Crane,
  Yard,
  Disruption,
  OptimizationRun,
  ScheduleItem,
  User,
  UserRole,
  SimulateOptimizationRequest,
  SimulationResponse,
  SentinelAlertResponse,
  PortTwinApiResponse,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let currentAuthToken = "";

export function setAuthToken(token: string) {
  currentAuthToken = token;
  if (typeof window !== "undefined") {
    localStorage.setItem("naviops_token", token);
    // Persist to cookie for Next.js middleware and SSR route protection
    document.cookie = `naviops_token=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=Lax`;
  }
}

export function clearAuthToken() {
  currentAuthToken = "";
  if (typeof window !== "undefined") {
    localStorage.removeItem("naviops_token");
    localStorage.removeItem("naviops_role");
    localStorage.removeItem("naviops_user");
    document.cookie = "naviops_token=; path=/; max-age=0; SameSite=Lax";
  }
}

export function getAuthToken(): string {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("naviops_token");
    if (saved) return saved;

    // Fallback: parse cookie if localStorage was cleared
    const match = document.cookie.match(new RegExp("(^| )naviops_token=([^;]+)"));
    if (match) return decodeURIComponent(match[2]);
  }
  return currentAuthToken;
}

async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (networkErr: any) {
    const err = new Error(networkErr?.message || "Failed to reach NaviOps API server. Please check your network or server status.") as any;
    err.status = 0; // Distinguish network disconnect from HTTP 401
    err.isNetworkError = true;
    throw err;
  }

  if (!response.ok) {
    let errorDetail = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.detail) errorDetail = errJson.detail;
    } catch {
      // ignore
    }
    const err = new Error(errorDetail) as any;
    err.status = response.status;
    throw err;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // Auth
  getCurrentUser: () => fetchWithAuth<User>("/api/auth/me"),
  listUsers: () => fetchWithAuth<User[]>("/api/auth/users"),
  loginAs: (emailOrRole: string) =>
    fetchWithAuth<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: emailOrRole }),
    }),

  // Dashboard & Congestion
  getDashboardSummary: () => fetchWithAuth<DashboardSummary>("/api/dashboard/summary"),
  getCongestion: () => fetchWithAuth<CongestionData>("/api/dashboard/congestion"),
  resetDemoData: () => fetchWithAuth<{ status: string; message: string }>("/api/dashboard/reset-demo", { method: "POST" }),

  // Vessels
  getVessels: (status?: string) =>
    fetchWithAuth<Vessel[]>(`/api/vessels${status ? `?status=${status}` : ""}`),
  getVessel: (id: string) => fetchWithAuth<Vessel>(`/api/vessels/${id}`),
  createVessel: (data: Partial<Vessel>) =>
    fetchWithAuth<Vessel>("/api/vessels", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateVessel: (id: string, data: Partial<Vessel>) =>
    fetchWithAuth<Vessel>(`/api/vessels/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteVessel: (id: string) =>
    fetchWithAuth<void>(`/api/vessels/${id}`, {
      method: "DELETE",
    }),

  // Berths
  getBerths: () => fetchWithAuth<Berth[]>("/api/berths"),
  createBerth: (data: Partial<Berth>) =>
    fetchWithAuth<Berth>("/api/berths", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateBerth: (id: string, data: Partial<Berth>) =>
    fetchWithAuth<Berth>(`/api/berths/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteBerth: (id: string) =>
    fetchWithAuth<void>(`/api/berths/${id}`, {
      method: "DELETE",
    }),

  // Cranes
  getCranes: () => fetchWithAuth<Crane[]>("/api/cranes"),
  createCrane: (data: Partial<Crane>) =>
    fetchWithAuth<Crane>("/api/cranes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCrane: (id: string, data: Partial<Crane>) =>
    fetchWithAuth<Crane>(`/api/cranes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteCrane: (id: string) =>
    fetchWithAuth<void>(`/api/cranes/${id}`, {
      method: "DELETE",
    }),

  // Yards
  getYards: () => fetchWithAuth<Yard[]>("/api/yards"),
  updateYard: (id: string, data: Partial<Yard>) =>
    fetchWithAuth<Yard>(`/api/yards/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Disruptions
  getDisruptions: (status?: string) =>
    fetchWithAuth<Disruption[]>(`/api/disruptions${status ? `?status=${status}` : ""}`),
  createDisruption: (data: Partial<Disruption>) =>
    fetchWithAuth<Disruption>("/api/disruptions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDisruption: (id: string, data: Partial<Disruption>) =>
    fetchWithAuth<Disruption>(`/api/disruptions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteDisruption: (id: string) =>
    fetchWithAuth<void>(`/api/disruptions/${id}`, {
      method: "DELETE",
    }),
  getDisruptionSentinel: () =>
    fetchWithAuth<SentinelAlertResponse>("/api/disruptions/sentinel"),

  // Optimization
  runOptimization: () =>
    fetchWithAuth<OptimizationRun>("/api/optimization/run", {
      method: "POST",
    }),
  getLatestOptimizationRun: () =>
    fetchWithAuth<OptimizationRun>("/api/optimization/runs/latest"),
  listOptimizationRuns: () =>
    fetchWithAuth<OptimizationRun[]>("/api/optimization/runs"),
  simulateOptimization: (payload: SimulateOptimizationRequest) =>
    fetchWithAuth<SimulationResponse>("/api/optimization/simulate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  applySchedule: (runId: string) =>
    fetchWithAuth<{ status: string; message: string }>("/api/optimization/apply", {
      method: "POST",
      body: JSON.stringify({ run_id: runId }),
    }),

  // Live Port Digital Twin Telemetry
  getPortTwinData: () => fetchWithAuth<PortTwinApiResponse>("/api/port-twin"),

  // Copilot — Chat
  copilotChat: (
    message: string,
    history?: Array<{ role: string; content: string }>,
    sessionId?: string,
    conversationId?: string,
  ) =>
    fetchWithAuth<{
      reply: string;
      session_id?: string;
      conversation_id?: string;
      model: string;
      role_context: string;
      tools_used?: string[] | null;
    }>("/api/copilot/chat", {
      method: "POST",
      body: JSON.stringify({
        message,
        history: history ?? [],
        session_id: sessionId,
        conversation_id: conversationId ?? null,
      }),
    }),
  copilotStatus: () =>
    fetchWithAuth<{
      copilot: string;
      phase: string;
      configured: boolean;
      model: string | null;
      status: string;
      tools_available: string[];
      actions_available: string[];
    }>("/api/copilot/status"),
  copilotRunOptimization: () =>
    fetchWithAuth<{ action: string; status: string; message: string; result: Record<string, unknown> | null }>("/api/copilot/action/run-optimization", {
      method: "POST",
    }),

  // Copilot — Conversation persistence
  listConversations: () =>
    fetchWithAuth<Array<{ id: string; title: string; created_at: string; updated_at: string }>>(
      "/api/copilot/conversations"
    ),
  createConversation: (title?: string) =>
    fetchWithAuth<{ id: string; title: string; created_at: string; updated_at: string }>(
      "/api/copilot/conversations",
      {
        method: "POST",
        body: JSON.stringify({ title: title ?? null }),
      }
    ),
  getConversation: (id: string) =>
    fetchWithAuth<{
      id: string;
      title: string;
      created_at: string;
      updated_at: string;
      messages: Array<{ id: string; conversation_id: string; role: string; content: string; created_at: string }>;
    }>(`/api/copilot/conversations/${id}`),
  renameConversation: (id: string, title: string) =>
    fetchWithAuth<{ id: string; title: string; created_at: string; updated_at: string }>(
      `/api/copilot/conversations/${id}/title`,
      {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }
    ),
  deleteConversation: (id: string) =>
    fetchWithAuth<void>(`/api/copilot/conversations/${id}`, { method: "DELETE" }),

  // Auth & Personnel Directory
  login: (email: string, password: string) =>
    fetchWithAuth<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.trim(), password }),
    }),
  getMe: () => fetchWithAuth<User>("/api/auth/me"),
  getUsers: () => fetchWithAuth<User[]>("/api/auth/users"),
  adminCreateUser: (data: {
    email: string;
    password: string;
    full_name: string;
    department?: string;
    role?: UserRole | string;
  }) =>
    fetchWithAuth<User>("/api/auth/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateUserRole: (userId: string, role: string) =>
    fetchWithAuth<User>(`/api/auth/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),
  updateUserPassword: (userId: string, password: string) =>
    fetchWithAuth<User>(`/api/auth/users/${userId}/password`, {
      method: "PUT",
      body: JSON.stringify({ password }),
    }),
  deleteUser: (userId: string) =>
    fetchWithAuth<{ message: string; id: string }>(`/api/auth/users/${userId}`, {
      method: "DELETE",
    }),
};

