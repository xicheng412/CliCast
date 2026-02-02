interface WsClient {
  ws: WebSocket;
  sessionId: string;
  connectedAt: number;
}

const clients = new Map<string, WsClient[]>();

// Extend Request interface to include webSocket for TypeScript
declare module 'bun' {
  interface Request {
    webSocket?: WebSocket;
  }
}

export function handleWebSocket(request: Request): Response | undefined {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    return new Response('Missing sessionId parameter', { status: 400 });
  }

  // Check if it's a WebSocket upgrade request
  const upgradeHeader = request.headers.get('upgrade');
  if (upgradeHeader !== 'websocket') {
    return undefined;
  }

  // Accept the WebSocket connection using Bun's API
  const ws = (request as unknown as { webSocket?: WebSocket }).webSocket;

  if (!ws) {
    return new Response('WebSocket upgrade failed', { status: 500 });
  }

  console.log(`[ws] Client connected: sessionId=${sessionId}`);

  // Add client to the session's client list
  const sessionClients = clients.get(sessionId) || [];
  const client: WsClient = {
    ws,
    sessionId,
    connectedAt: Date.now(),
  };
  sessionClients.push(client);
  clients.set(sessionId, sessionClients);

  // Send connection acknowledgment
  ws.send(JSON.stringify({ type: 'connected', sessionId }));

  // Handle incoming messages
  ws.onmessage = (event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data.toString());
      handleMessage(sessionId, message);
    } catch (error) {
      console.error('[ws] Failed to parse message:', error);
    }
  };

  // Handle close
  ws.onclose = (event: CloseEvent) => {
    console.log(`[ws] Client disconnected: sessionId=${sessionId} code=${event.code} reason=${event.reason}`);
    removeClient(sessionId, ws);
  };

  // Handle errors
  ws.onerror = (error: Event) => {
    console.error(`[ws] Error for session ${sessionId}:`, error);
    removeClient(sessionId, ws);
  };

  return undefined; // Return undefined to let Bun handle the upgrade
}

function handleMessage(sessionId: string, message: { type: string; data?: string; cols?: number; rows?: number }) {
  if (message.type === 'input' && message.data) {
    console.log(`[ws] Input for session ${sessionId}: ${JSON.stringify(message.data.slice(0, 50))}...`);
    globalThis.dispatchEvent(new CustomEvent('ws:input', { detail: { sessionId, data: message.data } }));
  } else if (message.type === 'resize' && message.cols && message.rows) {
    console.log(`[ws] Resize for session ${sessionId}: ${message.cols}x${message.rows}`);
    globalThis.dispatchEvent(new CustomEvent('ws:resize', { detail: { sessionId, cols: message.cols, rows: message.rows } }));
  }
}

function removeClient(sessionId: string, ws: WebSocket) {
  const sessionClients = clients.get(sessionId);
  if (sessionClients) {
    const filtered = sessionClients.filter((c) => c.ws !== ws);
    if (filtered.length === 0) {
      clients.delete(sessionId);
    } else {
      clients.set(sessionId, filtered);
    }
  }
}

export function sendToSession(sessionId: string, type: string, data: unknown): void {
  const sessionClients = clients.get(sessionId);
  if (!sessionClients) {
    console.log(`[ws] No clients for session ${sessionId}`);
    return;
  }

  const message = JSON.stringify({ type, data });
  let sentCount = 0;
  let failedCount = 0;

  for (const client of sessionClients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
      sentCount++;
    } else {
      failedCount++;
    }
  }

  if (failedCount > 0) {
    removeClosedClients(sessionId);
  }
}

function removeClosedClients(sessionId: string) {
  const sessionClients = clients.get(sessionId);
  if (sessionClients) {
    const filtered = sessionClients.filter((c) => c.ws.readyState === WebSocket.OPEN);
    if (filtered.length === 0) {
      clients.delete(sessionId);
    } else {
      clients.set(sessionId, filtered);
    }
  }
}

export function broadcastToSession(sessionId: string, event: string, data: unknown): void {
  sendToSession(sessionId, event, data);
}

export function closeSessionClients(sessionId: string): void {
  const sessionClients = clients.get(sessionId);
  if (sessionClients) {
    for (const client of sessionClients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(1000, 'Session closed');
      }
    }
    clients.delete(sessionId);
  }
}

export function getClientCount(sessionId?: string): number {
  if (sessionId) {
    return clients.get(sessionId)?.length || 0;
  }
  let total = 0;
  for (const sessionClients of clients.values()) {
    total += sessionClients.length;
  }
  return total;
}

export function shutdown(): Promise<void> {
  return new Promise((resolve) => {
    // Close all client connections
    for (const [, sessionClients] of clients) {
      for (const client of sessionClients) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.close(1001, 'Server shutting down');
        }
      }
    }
    clients.clear();

    resolve();
  });
}