import {
  CustomerAuthSession,
  CustomerUser,
  CustomerOrganization,
  CustomerVessel,
  ArrivalRequest,
  AuditLogItem,
  CustomerNotification,
} from "@/types/customer";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CUSTOMER_TOKEN_KEY = "naviops_customer_token";
const CUSTOMER_USER_KEY = "naviops_customer_user";
const CUSTOMER_ORG_KEY = "naviops_customer_org";

export function getCustomerAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CUSTOMER_TOKEN_KEY);
}

export function setCustomerAuthToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  // Set cookie for Next.js middleware
  document.cookie = `${CUSTOMER_TOKEN_KEY}=${token}; path=/; max-age=604800; SameSite=Lax`;
}

export function clearCustomerAuthToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
  localStorage.removeItem(CUSTOMER_USER_KEY);
  localStorage.removeItem(CUSTOMER_ORG_KEY);
  document.cookie = `${CUSTOMER_TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function getCachedCustomerSession(): {
  user: CustomerUser | null;
  org: CustomerOrganization | null;
} {
  if (typeof window === "undefined") return { user: null, org: null };
  try {
    const u = localStorage.getItem(CUSTOMER_USER_KEY);
    const o = localStorage.getItem(CUSTOMER_ORG_KEY);
    return {
      user: u ? JSON.parse(u) : null,
      org: o ? JSON.parse(o) : null,
    };
  } catch {
    return { user: null, org: null };
  }
}

export function setCachedCustomerSession(session: CustomerAuthSession) {
  if (typeof window === "undefined") return;
  setCustomerAuthToken(session.token);
  localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(session.user));
  localStorage.setItem(CUSTOMER_ORG_KEY, JSON.stringify(session.organization));
}

async function customerFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getCustomerAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errData = await response.json();
      errorDetail = errData.detail || errorDetail;
    } catch {
      // Use fallback
    }
    const err: any = new Error(errorDetail);
    err.status = response.status;
    throw err;
  }

  if (response.status === 204) {
    return null as any;
  }

  return response.json();
}

export const customerApi = {
  // ── Authentication ──
  async signup(payload: any): Promise<CustomerAuthSession> {
    const session = await customerFetch<CustomerAuthSession>(
      "/api/customer/auth/signup",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    setCachedCustomerSession(session);
    return session;
  },

  async login(email: string, pass: string): Promise<CustomerAuthSession> {
    const session = await customerFetch<CustomerAuthSession>(
      "/api/customer/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password: pass }),
      }
    );
    setCachedCustomerSession(session);
    return session;
  },

  async getMe(): Promise<CustomerAuthSession> {
    const session = await customerFetch<CustomerAuthSession>(
      "/api/customer/auth/me"
    );
    setCachedCustomerSession(session);
    return session;
  },

  // ── Organization & Users ──
  async getOrganization(): Promise<CustomerOrganization> {
    return customerFetch<CustomerOrganization>("/api/customer/organization");
  },

  async updateOrganization(payload: any): Promise<CustomerOrganization> {
    return customerFetch<CustomerOrganization>("/api/customer/organization", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async getUsers(): Promise<CustomerUser[]> {
    return customerFetch<CustomerUser[]>("/api/customer/users");
  },

  async createUser(payload: any): Promise<CustomerUser> {
    return customerFetch<CustomerUser>("/api/customer/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ── Vessels ──
  async getVessels(): Promise<CustomerVessel[]> {
    return customerFetch<CustomerVessel[]>("/api/customer/vessels");
  },

  async getVessel(id: string): Promise<CustomerVessel> {
    return customerFetch<CustomerVessel>(`/api/customer/vessels/${id}`);
  },

  async createVessel(payload: any): Promise<CustomerVessel> {
    return customerFetch<CustomerVessel>("/api/customer/vessels", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateVessel(id: string, payload: any): Promise<CustomerVessel> {
    return customerFetch<CustomerVessel>(`/api/customer/vessels/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async deleteVessel(id: string): Promise<void> {
    return customerFetch<void>(`/api/customer/vessels/${id}`, {
      method: "DELETE",
    });
  },

  // ── Arrival Requests ──
  async getArrivalRequests(statusFilter?: string): Promise<ArrivalRequest[]> {
    const query = statusFilter ? `?status_filter=${statusFilter}` : "";
    return customerFetch<ArrivalRequest[]>(
      `/api/customer/arrival-requests${query}`
    );
  },

  async getArrivalRequest(id: string): Promise<ArrivalRequest> {
    return customerFetch<ArrivalRequest>(
      `/api/customer/arrival-requests/${id}`
    );
  },

  async createArrivalRequest(payload: any): Promise<ArrivalRequest> {
    return customerFetch<ArrivalRequest>("/api/customer/arrival-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateArrivalRequest(id: string, payload: any): Promise<ArrivalRequest> {
    return customerFetch<ArrivalRequest>(
      `/api/customer/arrival-requests/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    );
  },

  async cancelArrivalRequest(id: string): Promise<ArrivalRequest> {
    return customerFetch<ArrivalRequest>(
      `/api/customer/arrival-requests/${id}/cancel`,
      {
        method: "POST",
      }
    );
  },

  async acceptAlternative(
    id: string,
    notes?: string
  ): Promise<ArrivalRequest> {
    return customerFetch<ArrivalRequest>(
      `/api/customer/arrival-requests/${id}/accept-alternative`,
      {
        method: "POST",
        body: JSON.stringify({ notes }),
      }
    );
  },

  async declineAlternative(
    id: string,
    notes?: string
  ): Promise<ArrivalRequest> {
    return customerFetch<ArrivalRequest>(
      `/api/customer/arrival-requests/${id}/decline-alternative`,
      {
        method: "POST",
        body: JSON.stringify({ notes }),
      }
    );
  },

  async getAuditTrail(id: string): Promise<AuditLogItem[]> {
    return customerFetch<AuditLogItem[]>(
      `/api/customer/arrival-requests/${id}/audit-trail`
    );
  },

  // ── Notifications ──
  async getNotifications(): Promise<CustomerNotification[]> {
    return customerFetch<CustomerNotification[]>("/api/customer/notifications");
  },

  async markNotificationRead(id: string): Promise<void> {
    return customerFetch<void>(`/api/customer/notifications/${id}/read`, {
      method: "PUT",
    });
  },
};
