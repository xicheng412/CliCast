import * as pty from 'node-pty';
import type { IPty } from 'node-pty';

let devPty: IPty | null = null;
const clients = new Set<(data: string) => void>();

export function isAlive(): boolean {
  return devPty !== null;
}

export function getOrCreate(cols: number, rows: number): { isNew: boolean } {
  if (devPty) {
    return { isNew: false };
  }

  const shell = process.env.SHELL || '/bin/bash';
  const home = process.env.HOME || '/';

  devPty = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: home,
    env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
  });

  devPty.onData((data) => {
    clients.forEach((cb) => cb(data));
  });

  devPty.onExit(() => {
    devPty = null;
  });

  return { isNew: true };
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
    devPty.kill('SIGKILL');
    devPty = null;
  }
}
