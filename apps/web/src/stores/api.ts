import type { Config, DirResponse, Breadcrumb, Session } from '@online-cc/types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
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

  async createSession(path: string): Promise<TerminalSession> {
    const response = await fetchJson<{ success: true; data: TerminalSession }>(`${API_BASE}/sessions`, {
      method: 'POST',
      body: JSON.stringify({ path }),
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

  async getWebSocketUrl(sessionId: string): Promise<string> {
    const response = await fetchJson<{ success: true; data: { wsUrl: string; sessionId: string } }>(
      `${API_BASE}/sessions/${sessionId}/ws`
    );
    return response.data.wsUrl;
  },

  // SSE Stream (legacy, kept for reference)
  createEventSource(sessionId: string): EventSource {
    return new EventSource(`${API_BASE}/sessions/${sessionId}/stream`);
  },
};