import type { Config, DirResponse, Breadcrumb, Session } from '@clicast/types';

const API_BASE = '/api';

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export interface TerminalSession extends Session {
  wsUrl: string;
}

export const api = {
  // Config
  async getConfig(): Promise<Config> {
    const response = await fetchJson<{ success: true; data: Config }>(`${API_BASE}/config`);
    return response.data;
  },

  async updateConfig(updates: Partial<Config>): Promise<Config> {
    const response = await fetchJson<{ success: true; data: Config }>(`${API_BASE}/config`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data;
  },

  // Dirs
  async listDir(path: string): Promise<DirResponse> {
    const response = await fetchJson<{ success: true; data: DirResponse }>(
      `${API_BASE}/dirs?path=${encodeURIComponent(path)}`
    );
    return response.data;
  },

  async getBreadcrumbs(path: string): Promise<Breadcrumb[]> {
    const response = await fetchJson<{ success: true; data: Breadcrumb[] }>(
      `${API_BASE}/dirs/breadcrumbs?path=${encodeURIComponent(path)}`
    );
    return response.data;
  },

  async getHomeDir(): Promise<{ path: string }> {
    const response = await fetchJson<{ success: true; data: { path: string } }>(`${API_BASE}/dirs/home`);
    return response.data;
  },

  // Sessions
  async getSessions(): Promise<Session[]> {
    const response = await fetchJson<{ success: true; data: Session[] }>(`${API_BASE}/sessions`);
    return response.data;
  },

  async createSession(path: string, aiCommandId?: string): Promise<TerminalSession> {
    const response = await fetchJson<{ success: true; data: TerminalSession }>(`${API_BASE}/sessions`, {
      method: 'POST',
      body: JSON.stringify({ path, aiCommandId }),
    });
    return response.data;
  },

  async deleteSession(id: string): Promise<void> {
    await fetchJson<{ success: true }>(`${API_BASE}/sessions/${id}`, {
      method: 'DELETE',
    });
  },

  async stopSession(id: string): Promise<Session> {
    const response = await fetchJson<{ success: true; data: Session }>(`${API_BASE}/sessions/${id}/stop`, {
      method: 'POST',
    });
    return response.data;
  },

  // Auth
  async checkAuthStatus(): Promise<{ hasToken: boolean }> {
    const response = await fetchJson<{ success: true; data: { hasToken: boolean } }>(
      `${API_BASE}/auth/status`
    );
    return response.data;
  },

  async initToken(token: string): Promise<void> {
    await fetchJson<{ success: true }>(`${API_BASE}/auth/init`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  async verifyToken(token: string): Promise<void> {
    const response = await fetchJson<{ success: true; data: { valid: boolean } }>(
      `${API_BASE}/auth/verify`,
      {
        method: 'POST',
        body: JSON.stringify({ token }),
      }
    );
    if (!response.data.valid) {
      throw new Error('Invalid token');
    }
  },

  async updateToken(currentToken: string, newToken: string): Promise<void> {
    await fetchJson<{ success: true }>(`${API_BASE}/auth`, {
      method: 'PUT',
      body: JSON.stringify({ currentToken, newToken }),
    });
  },
};