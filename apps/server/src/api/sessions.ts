import { Hono } from 'hono';
import { createSession, getSessions, getSession, deleteSession, terminateSession } from '../services/terminal.js';
import { getConfig } from '../services/config.js';
import { validatePath, listDir } from '../services/file.js';
import { authMiddleware } from '../services/auth.js';
import type { ApiResponse, Session, CreateSessionRequest } from '@clicast/types';

const app = new Hono();

app.use('/*', authMiddleware);

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

// Create a new session and start PTY
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

    // Create session (PTY will start when WebSocket sends 'init')
    const session = createSession(body.path);

    // Build WebSocket URL based on the current request's origin
    const url = new URL(c.req.url);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${url.host}/ws?sessionId=${session.id}`;

    const response: ApiResponse<Session & { wsUrl: string }> = {
      success: true,
      data: {
        ...session,
        wsUrl,
      },
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

// Get WebSocket URL for a session
app.get('/:id/ws', async (c) => {
  const id = c.req.param('id');
  const session = getSession(id);

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  // Build WebSocket URL based on the current request's origin
  const url = new URL(c.req.url);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${url.host}/ws?sessionId=${id}`;

  return c.json({
    success: true,
    data: {
      wsUrl,
      sessionId: id,
    },
  });
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

export { app };
export default app;