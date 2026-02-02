// Configuration types
export interface Config {
  claudeCommand: string;
  allowedDirs: string[];
  port: number;
}

export interface ConfigUpdate {
  claudeCommand?: string;
  allowedDirs?: string[];
  port?: number;
}

// File types
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

// Session types
export type SessionStatus = 'idle' | 'running' | 'error' | 'timeout' | 'terminated';

export interface Session {
  id: string;
  path: string;
  status: SessionStatus;
  createdAt: number;
  lastActivity: number;
}

export interface CreateSessionRequest {
  path: string;
}

export interface SessionResponse {
  id: string;
  path: string;
  status: SessionStatus;
}

// Message types
export interface SendMessageRequest {
  message: string;
}

export interface StreamEvent {
  type: 'output' | 'error' | 'status' | 'done';
  data: string;
  sessionId?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}