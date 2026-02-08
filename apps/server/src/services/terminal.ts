import { spawn, type IPty } from 'bun-pty';
import { randomUUID } from 'crypto';
import type { Session, SessionStatus } from '@clicast/types';

interface PtySession extends Session {
  process?: IPty;
  ptyName?: string;
  aiCommand?: string;
  outputHistory?: string[];
}

export interface TerminalCallbacks {
  onOutput?: (data: string) => void;
  onStatusChange?: (status: SessionStatus) => void;
  onExit?: (code: number, signal?: number) => void;
  onError?: (message: string) => void;
}

const sessions = new Map<string, PtySession>();
const sessionCallbacks = new Map<string, TerminalCallbacks>();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds
const MAX_HISTORY_SIZE = 100 * 1024; // 100KB

function trimSessionHistory(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session?.outputHistory) return;
  let totalSize = 0;
  for (const chunk of session.outputHistory) {
    totalSize += chunk.length;
  }
  while (totalSize > MAX_HISTORY_SIZE && session.outputHistory.length > 0) {
    const removed = session.outputHistory.shift()!;
    totalSize -= removed.length;
  }
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function startHeartbeat() {
  if (heartbeatTimer) return;

  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (session.status === 'running' && now - session.lastActivity > SESSION_TIMEOUT) {
        terminateSession(id, 'terminated');
      }
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// Check if a session exists (for WebSocket validation)
export function sessionExists(sessionId: string): boolean {
  return sessions.has(sessionId);
}

// Create a session record without starting PTY (deferred start)
export function createSession(path: string, aiCommand?: string): Session {
  const id = randomUUID();
  const now = Date.now();

  const session: PtySession = {
    id,
    path,
    status: 'created', // Will become 'running' when PTY starts
    createdAt: now,
    lastActivity: now,
    aiCommand: aiCommand || 'claude',
  };

  sessions.set(id, session);
  startHeartbeat();

  console.log(`[terminal] Created session ${id} for path ${path} (PTY not started yet)`);

  return {
    id: session.id,
    path: session.path,
    status: session.status,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
  };
}

// Initialize terminal with dimensions (called when WebSocket sends 'init')
export function initializeTerminal(
  sessionId: string,
  cols: number,
  rows: number,
  callbacks: TerminalCallbacks
): boolean {
  const session = sessions.get(sessionId);
  if (!session) {
    console.error(`[terminal] Session ${sessionId} not found`);
    return false;
  }

  if (session.process) {
    console.log(`[terminal] Session ${sessionId} already has PTY running`);
    return true;
  }

  // Store callbacks for this session
  sessionCallbacks.set(sessionId, callbacks);

  // Start PTY with correct dimensions
  return startPty(sessionId, cols, rows);
}

function parseCommand(command: string, cwd: string): string[] {
  if (command === 'claude' || command.trim() === '') {
    return ['bash', '-c', `cd "${cwd}" && claude`];
  }

  if (command.includes('--workdir')) {
    const match = command.match(/--workdir\s+(\S+)/);
    const workdir = match ? match[1] : cwd;
    const rest = command.replace(/--workdir\s+(\S+)/, '').trim();
    return ['bash', '-c', `cd "${workdir}" && ${rest || command}`];
  }

  return ['bash', '-c', `cd "${cwd}" && ${command}`];
}

function buildPtyEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  env.TERM = 'xterm-color';
  env.COLORTERM = 'truecolor';

  return env;
}

function startPty(sessionId: string, cols: number, rows: number): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  const command = session.aiCommand || 'claude';
  const cwd = session.path;
  const commandParts = parseCommand(command, cwd);
  const shell = commandParts[0];
  const args = commandParts.slice(1);

  console.log(`[terminal] Starting PTY: ${shell} ${args.join(' ')} in ${cwd} (${cols}x${rows})`);

  try {
    const ptyProcess = spawn(shell, args, {
      name: 'xterm-color',
      cols,
      rows,
      cwd: cwd,
      env: buildPtyEnv(),
    });

    session.process = ptyProcess;
    session.ptyName = `pty-${sessionId}`;
    session.status = 'running';
    session.lastActivity = Date.now();
    session.outputHistory = [];

    const callbacks = sessionCallbacks.get(sessionId);

    // Notify status change
    callbacks?.onStatusChange?.('running');

    // Set up output handler
    ptyProcess.onData((data: string) => {
      session.lastActivity = Date.now();
      callbacks?.onOutput?.(data);
      if (session.outputHistory) {
        session.outputHistory.push(data);
        trimSessionHistory(sessionId);
      }
    });

    // Set up exit handler
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`[terminal] PTY exited: sessionId=${sessionId} code=${exitCode} signal=${signal}`);

      session.process = undefined;
      session.status = 'exited';
      session.lastActivity = Date.now();

      callbacks?.onStatusChange?.('exited');
      callbacks?.onExit?.(exitCode);
    });

    return true;
  } catch (error) {
    console.error(`[terminal] Failed to start PTY:`, error);
    session.status = 'exited';
    const callbacks = sessionCallbacks.get(sessionId);
    callbacks?.onError?.(error instanceof Error ? error.message : 'Failed to start PTY');
    callbacks?.onStatusChange?.('exited');
    return false;
  }
}

// Write input to terminal
export function writeToTerminal(sessionId: string, data: string): void {
  const session = sessions.get(sessionId);
  if (!session || !session.process) {
    console.error(`[terminal] No PTY process for session ${sessionId}`);
    return;
  }

  session.lastActivity = Date.now();
  session.process.write(data);
}

// Resize terminal
export function resizeTerminal(sessionId: string, cols: number, rows: number): void {
  const session = sessions.get(sessionId);
  if (!session || !session.process) {
    return;
  }

  session.lastActivity = Date.now();
  session.process.resize(cols, rows);
}

// Terminate a session
export function terminateSession(sessionId: string, reason: SessionStatus = 'terminated'): Session | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  console.log(`[terminal] Terminating session ${sessionId}: ${reason}`);

  if (session.process) {
    session.process.kill();
    session.process = undefined;
  }

  session.status = reason;
  session.lastActivity = Date.now();

  const callbacks = sessionCallbacks.get(sessionId);
  callbacks?.onStatusChange?.(reason);

  return {
    id: session.id,
    path: session.path,
    status: session.status,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
  };
}

// Delete a session
export function deleteSession(sessionId: string): boolean {
  terminateSession(sessionId, 'terminated');
  sessionCallbacks.delete(sessionId);
  return sessions.delete(sessionId);
}

// Get a single session
export function getSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  return {
    id: session.id,
    path: session.path,
    status: session.status,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
  };
}

// Get all sessions
export function getSessions(): Session[] {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    path: s.path,
    status: s.status,
    createdAt: s.createdAt,
    lastActivity: s.lastActivity,
  }));
}

// Unregister callbacks for a session
export function unregisterCallbacks(sessionId: string): void {
  sessionCallbacks.delete(sessionId);
}

// Cleanup all sessions
export function cleanupAllSessions() {
  stopHeartbeat();
  for (const [id] of sessions) {
    terminateSession(id, 'terminated');
    sessions.delete(id);
    sessionCallbacks.delete(id);
  }
}

// Get session output history
export function getSessionHistory(sessionId: string): string[] {
  const session = sessions.get(sessionId);
  return session?.outputHistory ? [...session.outputHistory] : [];
}
