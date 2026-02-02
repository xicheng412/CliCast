import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import type { Session, SessionStatus } from '@shared/types/index.js';

interface SessionRecord extends Session {
  process?: ChildProcess;
  outputBuffer: string;
}

const sessions = new Map<string, SessionRecord>();
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

export function createSession(path: string, claudeCommand: string): Session {
  const id = randomUUID();
  const now = Date.now();

  const session: SessionRecord = {
    id,
    path,
    status: 'idle',
    createdAt: now,
    lastActivity: now,
    outputBuffer: '',
  };

  sessions.set(id, session);
  startHeartbeat();

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

export function getSession(id: string): Session | null {
  const session = sessions.get(id);
  if (!session) return null;

  return {
    id: session.id,
    path: session.path,
    status: session.status,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
  };
}

export function terminateSession(id: string, reason: SessionStatus = 'terminated'): Session | null {
  const session = sessions.get(id);
  if (!session) return null;

  if (session.process) {
    session.process.kill('SIGTERM');
    session.process = undefined;
  }

  session.status = reason;
  session.lastActivity = Date.now();

  return {
    id: session.id,
    path: session.path,
    status: session.status,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
  };
}

export function deleteSession(id: string): boolean {
  terminateSession(id);
  return sessions.delete(id);
}

export async function sendMessage(
  id: string,
  message: string,
  onOutput: (data: string) => void,
  onError: (error: string) => void,
  onStatusChange: (status: SessionStatus) => void
): Promise<boolean> {
  const session = sessions.get(id);
  if (!session) return false;

  if (session.status === 'running' && session.process) {
    // Already running, just add to buffer for when it becomes idle
    session.outputBuffer += message + '\n';
    return true;
  }

  // Start Claude Code process
  session.status = 'running';
  session.lastActivity = Date.now();
  onStatusChange('running');

  return new Promise((resolve) => {
    const parts = claudeCommandParts(session.path, message);
    const proc = spawn(parts[0], parts.slice(1), {
      cwd: session.path,
      env: { ...process.env, NO_COLOR: '1' },
    });

    session.process = proc;
    session.outputBuffer = '';

    let output = '';
    let errorOutput = '';

    proc.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;
      session.lastActivity = Date.now();
      onOutput(text);
    });

    proc.stderr?.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      session.lastActivity = Date.now();
      onError(text);
    });

    proc.on('close', (code) => {
      session.process = undefined;

      if (code === 0) {
        session.status = 'idle';
        onStatusChange('idle');
      } else if (code === null || code === undefined) {
        session.status = 'error';
        onStatusChange('error');
      } else {
        session.status = 'error';
        onStatusChange('error');
      }

      session.lastActivity = Date.now();
      resolve(true);
    });

    proc.on('error', (err) => {
      session.process = undefined;
      session.status = 'error';
      session.lastActivity = Date.now();
      onError(`Process error: ${err.message}`);
      onStatusChange('error');
      resolve(false);
    });
  });
}

function claudeCommandParts(cwd: string, message: string): string[] {
  // This is a placeholder - in real implementation, we need to handle
  // Claude Code's actual CLI interface
  // For now, just echo the message as a demonstration
  return ['echo', `[Claude would process: ${message}]`];
}

export function cleanupAllSessions() {
  stopHeartbeat();
  for (const [id] of sessions) {
    terminateSession(id);
    sessions.delete(id);
  }
}

export function getSessionProcess(id: string): ChildProcess | undefined {
  return sessions.get(id)?.process;
}