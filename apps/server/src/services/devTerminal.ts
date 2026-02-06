import { spawn, type IPty } from 'bun-pty';
import { existsSync, statSync } from 'fs';

let devPty: IPty | null = null;
const clients = new Set<(data: string) => void>();

export function isAlive(): boolean {
  return devPty !== null;
}

export function getOrCreate(cols: number, rows: number): { isNew: boolean } {
  if (devPty) {
    return { isNew: false };
  }

  const shell = resolveShellPath();
  const cwd = resolveWorkingDirectory();

  devPty = spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: buildPtyEnv(),
  });

  devPty.onData((data) => {
    clients.forEach((cb) => cb(data));
  });

  devPty.onExit(() => {
    devPty = null;
  });

  return { isNew: true };
}

function buildPtyEnv(): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  env.TERM = 'xterm-256color';
  env.COLORTERM = 'truecolor';

  return env;
}

function resolveShellPath(): string {
  const candidates = [process.env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh'];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // ignore invalid candidate
    }
  }

  return '/bin/sh';
}

function resolveWorkingDirectory(): string {
  const candidates = [process.env.HOME, process.cwd(), '/'];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      if (existsSync(candidate) && statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // ignore invalid candidate
    }
  }

  return '/';
}

export function write(data: string): void {
  devPty?.write(data);
}

export function resize(cols: number, rows: number): void {
  devPty?.resize(cols, rows);
}

export function subscribe(callback: (data: string) => void): () => void {
  clients.add(callback);
  return () => clients.delete(callback);
}

export function kill(): void {
  if (devPty) {
    devPty.kill();
    devPty = null;
  }
}
