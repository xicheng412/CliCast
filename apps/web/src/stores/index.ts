import { writable, type Writable, get } from 'svelte/store';
import type { Config, Breadcrumb, Session, FileEntry, AiCommand } from '@clicast/types';
import { api, type TerminalSession } from './api';
import { authStore } from './auth';

// Use browser crypto API for UUID generation
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Recent paths store
function createRecentPathsStore() {
  const MAX_SIZE = 5;
  const STORAGE_KEY = 'recent-paths';

  // Load from localStorage
  function load(): string[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  // Save to localStorage
  function save(paths: string[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
  }

  const { subscribe, set, update }: Writable<string[]> = writable(load());

  return {
    subscribe,
    addPath(path: string) {
      update((paths) => {
        // Deduplicate and move to top
        const filtered = paths.filter((p) => p !== path);
        const updated = [path, ...filtered];
        // Limit size
        const result = updated.slice(0, MAX_SIZE);
        save(result);
        return result;
      });
    },
    removePath(path: string) {
      update((paths) => {
        const result = paths.filter((p) => p !== path);
        save(result);
        return result;
      });
    },
    clear() {
      set([]);
      localStorage.removeItem(STORAGE_KEY);
    },
  };
}

export const recentPathsStore = createRecentPathsStore();

// Config store with integrated AI Commands management
function createConfigStore() {
  const { subscribe, set, update }: Writable<Config | null> = writable(null);

  return {
    subscribe,
    async load() {
      try {
        const config = await api.getConfig();
        set(config);
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    },
    async update(updates: Partial<Config>) {
      try {
        const config = await api.updateConfig(updates);
        set(config);
        return config;
      } catch (error) {
        console.error('Failed to update config:', error);
        throw error;
      }
    },
    // AI Commands operations - integrated into config store
    async addAiCommand(cmd: Omit<AiCommand, 'id'>) {
      const current = get({ subscribe });
      if (!current) throw new Error('Config not loaded');

      const newCommand = {
        ...cmd,
        id: generateUUID(),
      } as AiCommand;

      const newCommands = [...current.aiCommands, newCommand];
      return this.update({ aiCommands: newCommands });
    },
    async updateAiCommand(id: string, updates: Partial<AiCommand>) {
      const current = get({ subscribe });
      if (!current) throw new Error('Config not loaded');

      const newCommands = current.aiCommands.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      );
      return this.update({ aiCommands: newCommands });
    },
    async deleteAiCommand(id: string) {
      const current = get({ subscribe });
      if (!current) throw new Error('Config not loaded');

      const newCommands = current.aiCommands.filter((c) => c.id !== id);
      return this.update({ aiCommands: newCommands });
    },
    async reorderAiCommands(commands: AiCommand[]) {
      return this.update({ aiCommands: commands });
    },
    moveUp(id: string) {
      update((config) => {
        if (!config) return config;
        const index = config.aiCommands.findIndex((c) => c.id === id);
        if (index <= 0) return config;
        const newCommands = [...config.aiCommands];
        [newCommands[index - 1], newCommands[index]] = [newCommands[index], newCommands[index - 1]];
        return { ...config, aiCommands: newCommands };
      });
    },
    moveDown(id: string) {
      update((config) => {
        if (!config) return config;
        const index = config.aiCommands.findIndex((c) => c.id === id);
        if (index < 0 || index >= config.aiCommands.length - 1) return config;
        const newCommands = [...config.aiCommands];
        [newCommands[index], newCommands[index + 1]] = [newCommands[index + 1], newCommands[index]];
        return { ...config, aiCommands: newCommands };
      });
    },
  };
}

export const configStore = createConfigStore();

// Directory store
function createDirStore() {
  const { subscribe, set, update }: Writable<{
    currentPath: string;
    entries: FileEntry[];
    breadcrumbs: Breadcrumb[];
    loading: boolean;
    error: string | null;
  }> = writable({
    currentPath: '',
    entries: [],
    breadcrumbs: [],
    loading: false,
    error: null,
  });

  return {
    subscribe,
    async navigateTo(path: string) {
      update((state) => ({ ...state, loading: true, error: null }));

      try {
        const [entries, breadcrumbs] = await Promise.all([
          api.listDir(path),
          api.getBreadcrumbs(path),
        ]);

        set({
          currentPath: path,
          entries: entries.entries,
          breadcrumbs,
          loading: false,
          error: null,
        });
      } catch (error) {
        update((state) => ({
          ...state,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load directory',
        }));
      }
    },
    async refresh() {
      let currentPath = '';
      await new Promise<void>((resolve) => {
        subscribe((state) => {
          currentPath = state.currentPath;
          resolve();
        })();
      });

      if (currentPath) {
        await this.navigateTo(currentPath);
      }
    },
    clearError() {
      update((state) => ({ ...state, error: null }));
    },
  };
}

export const dirStore = createDirStore();

// Sessions store
function createSessionsStore() {
  const { subscribe, set, update }: Writable<{
    sessions: Session[];
    activeSessionId: string | null;
    activeSessionWsUrl: string | null;
    loading: boolean;
    error: string | null;
  }> = writable({
    sessions: [],
    activeSessionId: null,
    activeSessionWsUrl: null,
    loading: false,
    error: null,
  });

  return {
    subscribe,
    async load() {
      update((state) => ({ ...state, loading: true, error: null }));

      try {
        const sessions = await api.getSessions();
        set({
          sessions,
          activeSessionId: null,
          activeSessionWsUrl: null,
          loading: false,
          error: null,
        });
      } catch (error) {
        update((state) => ({
          ...state,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load sessions',
        }));
      }
    },
    async create(path: string, aiCommandId?: string): Promise<TerminalSession | null> {
      update((state) => ({ ...state, loading: true, error: null }));

      try {
        const session = await api.createSession(path, aiCommandId);

        // Construct WebSocket URL using browser's location.host for correct LAN access
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${location.host}/ws?sessionId=${session.id}`;

        update((state) => ({
          ...state,
          sessions: [...state.sessions, { ...session, wsUrl }],
          activeSessionId: session.id,
          activeSessionWsUrl: wsUrl,
          loading: false,
          error: null,
        }));
        return { ...session, wsUrl };
      } catch (error) {
        update((state) => ({
          ...state,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to create session',
        }));
        return null;
      }
    },
    async delete(id: string) {
      try {
        await api.deleteSession(id);
        update((state) => ({
          ...state,
          sessions: state.sessions.filter((s) => s.id !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
          activeSessionWsUrl: state.activeSessionId === id ? null : state.activeSessionWsUrl,
        }));
      } catch (error) {
        console.error('Failed to delete session:', error);
      }
    },
    async stop(id: string) {
      try {
        const session = await api.stopSession(id);
        update((state) => ({
          ...state,
          sessions: state.sessions.map((s) => (s.id === id ? session : s)),
        }));
      } catch (error) {
        console.error('Failed to stop session:', error);
      }
    },
    setActiveSession(id: string | null, wsUrl: string | null = null) {
      update((state) => ({ ...state, activeSessionId: id, activeSessionWsUrl: wsUrl }));
    },
    updateSession(session: Session) {
      update((state) => ({
        ...state,
        sessions: state.sessions.map((s) => (s.id === session.id ? session : s)),
      }));
    },
  };
}

export const sessionsStore = createSessionsStore();

// Auth store
export { authStore };

// UI State
export const viewMode = writable<'files' | 'config'>('files');