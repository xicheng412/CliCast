import { Hono } from 'hono';
import { createSession, getSessions, getSession, deleteSession, terminateSession, sendMessage } from '../services/claude.js';
import { getConfig } from '../services/config.js';
import { validatePath, listDir } from '../services/file.js';
import type { ApiResponse, Session, CreateSessionRequest } from '@shared/types/index.js';

const app = new Hono();
const SSE_DEBUG = process.env.SSE_DEBUG === '1';
const SSE_HEARTBEAT_MS = Number.parseInt(process.env.SSE_HEARTBEAT_MS || '5000', 10);
let streamSeq = 0;
const logSse = (...args: unknown[]) => {
  if (SSE_DEBUG) console.log('[sse]', ...args);
};

// Get all sessions
app.get('/', async (c) => {
  try {
    const sessions = getSessions();
    const response: ApiResponse<Session[]> = {
      success: true,
      data: sessions,
    };
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<Session[]> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sessions',
    };
    return c.json(response, 500);
  }
});

// Create a new session
app.post('/', async (c) => {
  try {
    const body = await c.req.json<CreateSessionRequest>();
    const config = getConfig();

    if (!body.path) {
      const response: ApiResponse<Session> = {
        success: false,
        error: 'Path is required',
      };
      return c.json(response, 400);
    }

    // Validate path
    if (!validatePath(body.path, config.allowedDirs)) {
      const response: ApiResponse<Session> = {
        success: false,
        error: 'Access to this directory is not allowed',
      };
      return c.json(response, 403);
    }

    // Check if directory exists
    try {
      listDir(body.path);
    } catch {
      const response: ApiResponse<Session> = {
        success: false,
        error: 'Directory does not exist or cannot be accessed',
      };
      return c.json(response, 400);
    }

    const session = createSession(body.path, config.claudeCommand);
    const response: ApiResponse<Session> = {
      success: true,
      data: session,
    };
    return c.json(response, 201);
  } catch (error) {
    const response: ApiResponse<Session> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create session',
    };
    return c.json(response, 500);
  }
});

// Get a specific session
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const session = getSession(id);

    if (!session) {
      const response: ApiResponse<Session> = {
        success: false,
        error: 'Session not found',
      };
      return c.json(response, 404);
    }

    const response: ApiResponse<Session> = {
      success: true,
      data: session,
    };
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<Session> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get session',
    };
    return c.json(response, 500);
  }
});

// Delete a session
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const deleted = deleteSession(id);

    if (!deleted) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Session not found',
      };
      return c.json(response, 404);
    }

    const response: ApiResponse<null> = {
      success: true,
    };
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete session',
    };
    return c.json(response, 500);
  }
});

// SSE stream for session updates
app.get('/:id/stream', async (c) => {
  const id = c.req.param('id');
  const session = getSession(id);

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  // Return SSE stream
  const body = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const streamId = `${id}-${++streamSeq}`;
      const connectedAt = Date.now();

      logSse('request', {
        id,
        streamId,
        accept: c.req.header('accept'),
        ua: c.req.header('user-agent'),
      });

      // Store the controller for sending messages
      // This will be used when messages are sent to the session
      const previous = pendingStreams.get(id);
      if (previous) {
        logSse('replace', { id, streamId, prevStreamId: previous.streamId });
        try {
          previous.controller.close();
        } catch {
          // ignore close errors
        }
        if (previous.heartbeatTimer) {
          clearInterval(previous.heartbeatTimer);
        }
        previous.active = false;
      }

      let active = true;

      const sendEvent = (type: string, data: string) => {
        if (!active) {
          return;
        }
        if (SSE_DEBUG && type !== 'output') {
          logSse('send', { id, streamId, type, bytes: data.length });
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
      };

      // Send initial connection event
      logSse('connect', { id, streamId });
      sendEvent('status', JSON.stringify({ status: session.status, sessionId: id }));

      let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
      if (SSE_HEARTBEAT_MS > 0) {
        heartbeatTimer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
          } catch (error) {
            logSse('heartbeat-error', { id, streamId, error });
          }
        }, SSE_HEARTBEAT_MS);
      }

      pendingStreams.set(id, { controller, sendEvent, active: true, streamId, connectedAt, heartbeatTimer });

      c.req.raw.signal.addEventListener('abort', () => {
        const durationMs = Date.now() - connectedAt;
        logSse('abort', { id, streamId, durationMs });
        active = false;
        pendingStreams.delete(id);
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
        }
        controller.close();
      });
    },
  });

  return c.newResponse(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});

// Send a message to a session
app.post('/:id/message', async (c) => {
  try {
    const id = c.req.param('id');
    const session = getSession(id);

    if (!session) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Session not found',
      };
      return c.json(response, 404);
    }

    const body = await c.req.json<{ message: string }>();
    if (!body.message) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Message is required',
      };
      return c.json(response, 400);
    }

    // Log the incoming message
    console.info(`[message] sessionId=${id} message=${JSON.stringify(body.message)}`);

    const stream = pendingStreams.get(id);
    if (stream) {
      stream.sendEvent('status', JSON.stringify({ status: 'running', sessionId: id }));
    }

    await sendMessage(
      id,
      body.message,
      (data) => {
        console.info(`[output] sessionId=${id} data=${JSON.stringify(data.slice(0, 100))}`);
        const stream = pendingStreams.get(id);
        console.info(`[output] stream exists=${!!stream}, active=${stream?.active}`);
        if (stream) {
          stream.sendEvent('output', data);
        }
      },
      (error) => {
        const stream = pendingStreams.get(id);
        if (stream) {
          stream.sendEvent('error', error);
        }
      },
      (status) => {
        console.info(`[status] sessionId=${id} status=${status}`);
        const stream = pendingStreams.get(id);
        if (stream) {
          stream.sendEvent('status', JSON.stringify({ status, sessionId: id }));
        }
      }
    );

    const response: ApiResponse<{ status: string }> = {
      success: true,
      data: { status: 'message_sent' },
    };
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    };
    return c.json(response, 500);
  }
});

// Stop a session
app.post('/:id/stop', async (c) => {
  try {
    const id = c.req.param('id');
    const session = terminateSession(id, 'terminated');

    if (!session) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Session not found',
      };
      return c.json(response, 404);
    }

    // Notify connected streams
    const stream = pendingStreams.get(id);
    if (stream) {
      stream.sendEvent('status', JSON.stringify({ status: 'terminated', sessionId: id }));
    }

    const response: ApiResponse<Session> = {
      success: true,
      data: session,
    };
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop session',
    };
    return c.json(response, 500);
  }
});

// Interface for active SSE streams
interface StreamInfo {
  controller: ReadableStreamDefaultController;
  sendEvent: (type: string, data: string) => void;
  active: boolean;
  streamId: string;
  connectedAt: number;
  heartbeatTimer?: ReturnType<typeof setInterval>;
}

// Store active SSE streams
const pendingStreams = new Map<string, StreamInfo>();

export { app, pendingStreams };
export default app;
