// Configuration types
export interface Config {
  aiCommand: string;
  allowedDirs: string[];
  port: number;
}

export interface ConfigUpdate {
  aiCommand?: string;
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
// State machine:
// - created: Session created, PTY not started yet
// - running: PTY is running
// - exited: PTY exited (normal or error)
// - terminated: Manually terminated by user
export type SessionStatus = 'created' | 'running' | 'exited' | 'terminated';

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

// WebSocket Message Types

// Client -> Server messages
export type ClientMessage =
  | { type: 'init'; cols: number; rows: number }
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'ping' };

// Server -> Client messages
export type ServerMessage =
  | { type: 'ready'; sessionId: string }
  | { type: 'output'; data: string }
  | { type: 'status'; status: SessionStatus; sessionId: string }
  | { type: 'error'; message: string }
  | { type: 'exit'; code: number; signal?: number }
  | { type: 'pong' };
