export interface Config {
  claudeCommand: string;
  allowedDirs: string[];
  port: number;
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: number;
}

export interface DirResponse {
  path: string;
  entries: FileEntry[];
}

export interface Breadcrumb {
  name: string;
  path: string;
}

export type SessionStatus = 'idle' | 'running' | 'error' | 'timeout' | 'terminated';

export interface Session {
  id: string;
  path: string;
  status: SessionStatus;
  createdAt: number;
  lastActivity: number;
}

export interface StreamEvent {
  type: 'output' | 'error' | 'status' | 'done';
  data: string;
  sessionId?: string;
}