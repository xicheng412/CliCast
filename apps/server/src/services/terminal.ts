import * as pty from 'node-pty';
import { randomUUID } from 'crypto';
import { sendToSession, broadcastToSession, closeSessionClients } from './websocket.js';
import { getConfig } from './config.js';
import type { Session, SessionStatus } from '@online-cc/types';

interface PtySession extends Session {
  process?: pty.IPty;
  ptyName?: string;
}

interface TerminalCallbacks {
  onOutput?: (sessionId: string, data: string) => void;
  onStatusChange?: (sessionId: string, status: SessionStatus) => void;
  onExit?: (sessionId: string) => void;
}

const sessions = new Map<string, PtySession>();
const callbacks = new Map<string, TerminalCallbacks>();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function startHeartbeat() {
  if (heartbeatTimer) return;

  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (session.status === 'running' && now - session.lastActivity > SESSION_TIMEOUT) {
        terminateSession(id, 'timeout');
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

// Handle WebSocket messages
if (typeof globalThis !== 'undefined') {
  globalThis.addEventListener('ws:input', ((event: CustomEvent) => {
    const { sessionId, data } = event.detail;
    handleInput(sessionId, data);
  }) as EventListener);

  globalThis.addEventListener('ws:resize', ((event: CustomEvent) => {
    const { sessionId, cols, rows } = event.detail;
    handleResize(sessionId, cols, rows);
  }) as EventListener);
}

function handleInput(sessionId: string, data: string) {
  const session = sessions.get(sessionId);
  if (!session || !session.process) {
    console.error(`[terminal] No session or process for ${sessionId}`);
    return;
  }

  session.lastActivity = Date.now();
  session.process.write(data);

  // Update status to running if idle
  if (session.status === 'idle') {
    session.status = 'running';
    broadcastToSession(sessionId, 'status', { status: 'running', sessionId });
    const cb = callbacks.get(sessionId);
    cb?.onStatusChange?.(sessionId, 'running');
  }
}

function handleResize(sessionId: string, cols: number, rows: number) {
  const session = sessions.get(sessionId);
  if (!session || !session.process) {
    return;
  }

  session.process.resize(cols, rows);
  session.lastActivity = Date.now();
}

export function createTerminal(path: string, claudeCommand: string): Session {
  const id = randomUUID();
  const now = Date.now();

  const session: PtySession = {
    id,
    path,
    status: 'idle',
    createdAt: now,
    lastActivity: now,
  };

  sessions.set(id, session);
  startHeartbeat();

  console.log(`[terminal] Created session ${id} for path ${path}`);

  // Start the PTY process with claude
  startClaude(id, path, claudeCommand);

  return {
    id: session.id,
    path: session.path,
    status: session.status,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
  };
}

function startClaude(sessionId: string, cwd: string, command: string) {
  const session = sessions.get(sessionId);
  if (!session) {
    console.error(`[terminal] Session ${sessionId} not found`);
    return;
  }

  const config = getConfig();

  // Parse command - handle "claude" or "claude --workdir /path"
  const commandParts = parseCommand(command, cwd);
  const shell = commandParts[0];
  const args = commandParts.slice(1);

  console.log(`[terminal] Starting PTY: ${shell} ${args.join(' ')} in ${cwd}`);

  try {
    const ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: cwd,
      env: {
        ...process.env,
        NO_COLOR: '1',
        TERM: 'xterm-color',
        COLORTERM: 'truecolor',
      },
    });

    session.process = ptyProcess;
    session.ptyName = `pty-${sessionId}`;
    session.status = 'running';
    session.lastActivity = Date.now();

    // Notify clients that session is running
    broadcastToSession(sessionId, 'status', { status: 'running', sessionId });

    // Set up output handlers
    ptyProcess.onData((data: string) => {
      session.lastActivity = Date.now();
      sendToSession(sessionId, 'output', data);

      const cb = callbacks.get(sessionId);
      cb?.onOutput?.(sessionId, data);
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      const code = exitCode;
      console.log(`[terminal] PTY exited: sessionId=${sessionId} code=${code} signal=${signal}`);

      session.process = undefined;
      session.status = code === 0 ? 'idle' : 'error';
      session.lastActivity = Date.now();

      // Notify clients
      broadcastToSession(sessionId, 'status', { status: session.status, sessionId });
      broadcastToSession(sessionId, 'exit', { code, signal });

      const cb = callbacks.get(sessionId);
      cb?.onStatusChange?.(sessionId, session.status);
      cb?.onExit?.(sessionId);

      // Close WebSocket clients after a delay to allow exit message to be received
      setTimeout(() => closeSessionClients(sessionId), 1500);
    });

  } catch (error) {
    console.error(`[terminal] Failed to start PTY:`, error);
    session.status = 'error';
    broadcastToSession(sessionId, 'error', { message: error instanceof Error ? error.message : 'Failed to start PTY' });
  }
}

function parseCommand(command: string, cwd: string): string[] {
  // If command is just "claude", expand to full path or use shell's default
  if (command === 'claude' || command.trim() === '') {
    // Default: use bash with claude command
    return ['bash', '-c', `cd "${cwd}" && claude`];
  }

  // Handle commands with arguments
  // e.g., "claude --workdir /path" -> ["bash", "-c", "cd /path && claude"]
  if (command.includes('--workdir')) {
    const match = command.match(/--workdir\s+(\S+)/);
    const workdir = match ? match[1] : cwd;
    const rest = command.replace(/--workdir\s+(\S+)/, '').trim();
    return ['bash', '-c', `cd "${workdir}" && ${rest || 'claude'}`];
  }

  return ['bash', '-c', `cd "${cwd}" && ${command}`];
}

export function sendToTerminal(sessionId: string, data: string): void {
  const session = sessions.get(sessionId);
  if (!session || !session.process) {
    console.error(`[terminal] No PTY process for session ${sessionId}`);
    return;
  }

  session.lastActivity = Date.now();
  session.process.write(data);
}

export function resizeTerminal(sessionId: string, cols: number, rows: number): void {
  const session = sessions.get(sessionId);
  if (!session || !session.process) {
    return;
  }

  session.lastActivity = Date.now();
  session.process.resize(cols, rows);
}

export function terminateSession(sessionId: string, reason: SessionStatus = 'terminated'): Session | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  console.log(`[terminal] Terminating session ${sessionId}: ${reason}`);

  if (session.process) {
    session.process.kill('SIGTERM');
    session.process = undefined;
  }

  session.status = reason;
  session.lastActivity = Date.now();

  // Notify clients
  broadcastToSession(sessionId, 'status', { status: reason, sessionId });
  closeSessionClients(sessionId);

  const cb = callbacks.get(sessionId);
  cb?.onStatusChange?.(sessionId, reason);

  return {
    id: session.id,
    path: session.path,
    status: session.status,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
  };
}

export function deleteSession(sessionId: string): boolean {
  terminateSession(sessionId, 'terminated');
  callbacks.delete(sessionId);
  return sessions.delete(sessionId);
}

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

export function getSessions(): Session[] {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    path: s.path,
    status: s.status,
    createdAt: s.createdAt,
    lastActivity: s.lastActivity,
  }));
}

export function registerCallbacks(sessionId: string, cb: TerminalCallbacks): void {
  callbacks.set(sessionId, cb);
}

export function unregisterCallbacks(sessionId: string): void {
  callbacks.delete(sessionId);
}

export function cleanupAllSessions() {
  stopHeartbeat();
  for (const [id] of sessions) {
    terminateSession(id, 'terminated');
    sessions.delete(id);
    callbacks.delete(id);
  }
}