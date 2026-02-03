import type { ServerWebSocket } from 'bun';
import type { ClientMessage, ServerMessage } from '@online-cc/types';
import {
  sessionExists,
  initializeTerminal,
  writeToTerminal,
  resizeTerminal,
  unregisterCallbacks,
} from './terminal.js';

interface WsData {
  sessionId: string;
  connectedAt: number;
  initialized: boolean;
}

const clients = new Map<string, Set<ServerWebSocket<WsData>>>();

// WebSocket handlers for Bun.serve()
export const websocketHandlers = {
  open(ws: ServerWebSocket<WsData>) {
    const { sessionId } = ws.data;
    console.log(`[ws] Client connected: sessionId=${sessionId}`);

    // Add client to the session's client set
    let sessionClients = clients.get(sessionId);
    if (!sessionClients) {
      sessionClients = new Set();
      clients.set(sessionId, sessionClients);
    }
    sessionClients.add(ws);

    // Don't send 'connected' - wait for client to send 'init' first
  },

  message(ws: ServerWebSocket<WsData>, message: string | Buffer) {
    const { sessionId } = ws.data;
    const rawMessage = message.toString();

    try {
      const parsed = JSON.parse(rawMessage) as ClientMessage;
      handleMessage(ws, sessionId, parsed);
    } catch (error) {
      console.error('[ws] Failed to parse message:', error);
      sendMessage(ws, { type: 'error', message: 'Invalid message format' });
    }
  },

  close(ws: ServerWebSocket<WsData>, code: number, reason: string) {
    const { sessionId } = ws.data;
    console.log(`[ws] Client disconnected: sessionId=${sessionId} code=${code} reason=${reason}`);
    removeClient(sessionId, ws);
  },

  error(ws: ServerWebSocket<WsData>, error: Error) {
    const { sessionId } = ws.data;
    console.error(`[ws] Error for session ${sessionId}:`, error);
    removeClient(sessionId, ws);
  },
};

// Upgrade HTTP request to WebSocket - returns data for the connection
export function getUpgradeData(request: Request): WsData | null {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    console.log('[ws] Upgrade rejected: no sessionId');
    return null;
  }

  // Validate session exists
  if (!sessionExists(sessionId)) {
    console.log(`[ws] Upgrade rejected: session ${sessionId} not found`);
    return null;
  }

  return {
    sessionId,
    connectedAt: Date.now(),
    initialized: false,
  };
}

function sendMessage(ws: ServerWebSocket<WsData>, message: ServerMessage): void {
  try {
    ws.send(JSON.stringify(message));
  } catch {
    // Client may have disconnected
  }
}

function handleMessage(ws: ServerWebSocket<WsData>, sessionId: string, message: ClientMessage) {
  switch (message.type) {
    case 'init':
      handleInit(ws, sessionId, message.cols, message.rows);
      break;

    case 'input':
      if (!ws.data.initialized) {
        sendMessage(ws, { type: 'error', message: 'Terminal not initialized. Send init first.' });
        return;
      }
      writeToTerminal(sessionId, message.data);
      break;

    case 'resize':
      if (!ws.data.initialized) {
        return; // Silently ignore resize before init
      }
      resizeTerminal(sessionId, message.cols, message.rows);
      break;

    case 'ping':
      sendMessage(ws, { type: 'pong' });
      break;
  }
}

function handleInit(ws: ServerWebSocket<WsData>, sessionId: string, cols: number, rows: number) {
  if (ws.data.initialized) {
    console.log(`[ws] Session ${sessionId} already initialized`);
    sendMessage(ws, { type: 'ready', sessionId });
    return;
  }

  console.log(`[ws] Initializing terminal for session ${sessionId}: ${cols}x${rows}`);

  // Set up callbacks that send messages to all clients for this session
  const success = initializeTerminal(sessionId, cols, rows, {
    onOutput: (data) => {
      broadcastToSession(sessionId, { type: 'output', data });
    },
    onStatusChange: (status) => {
      broadcastToSession(sessionId, { type: 'status', status, sessionId });
    },
    onExit: (code, signal) => {
      broadcastToSession(sessionId, { type: 'exit', code, signal });
      // Close clients after a delay to allow exit message to be received
      setTimeout(() => closeSessionClients(sessionId), 1500);
    },
    onError: (message) => {
      broadcastToSession(sessionId, { type: 'error', message });
    },
  });

  if (success) {
    ws.data.initialized = true;
    sendMessage(ws, { type: 'ready', sessionId });
  } else {
    sendMessage(ws, { type: 'error', message: 'Failed to initialize terminal' });
  }
}

function removeClient(sessionId: string, ws: ServerWebSocket<WsData>) {
  const sessionClients = clients.get(sessionId);
  if (sessionClients) {
    sessionClients.delete(ws);
    if (sessionClients.size === 0) {
      clients.delete(sessionId);
      unregisterCallbacks(sessionId);
    }
  }
}

function broadcastToSession(sessionId: string, message: ServerMessage): void {
  const sessionClients = clients.get(sessionId);
  if (!sessionClients) return;

  const messageStr = JSON.stringify(message);

  for (const client of sessionClients) {
    try {
      client.send(messageStr);
    } catch {
      sessionClients.delete(client);
    }
  }

  if (sessionClients.size === 0) {
    clients.delete(sessionId);
  }
}

export function closeSessionClients(sessionId: string): void {
  const sessionClients = clients.get(sessionId);
  if (sessionClients) {
    for (const client of sessionClients) {
      try {
        client.close(1000, 'Session closed');
      } catch {
        // Ignore close errors
      }
    }
    clients.delete(sessionId);
    unregisterCallbacks(sessionId);
  }
}

export function getClientCount(sessionId?: string): number {
  if (sessionId) {
    return clients.get(sessionId)?.size || 0;
  }
  let total = 0;
  for (const sessionClients of clients.values()) {
    total += sessionClients.size;
  }
  return total;
}

export function shutdown(): Promise<void> {
  return new Promise((resolve) => {
    for (const [, sessionClients] of clients) {
      for (const client of sessionClients) {
        try {
          client.close(1001, 'Server shutting down');
        } catch {
          // Ignore close errors
        }
      }
    }
    clients.clear();
    resolve();
  });
}
