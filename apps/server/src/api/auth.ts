import { Hono } from 'hono';
import {
  tokenFileExists,
  createToken,
  verifyToken,
  updateToken,
  deleteToken,
  getTokenFilePath,
} from '../services/token.js';
import type { ApiResponse } from '@clicast/types';

const app = new Hono();

/**
 * GET /auth/status
 * Returns whether a token exists on the server
 */
app.get('/status', async (c) => {
  const response: ApiResponse<{ hasToken: boolean }> = {
    success: true,
    data: {
      hasToken: tokenFileExists(),
    },
  };
  return c.json(response);
});

/**
 * POST /auth/init
 * Create the first token (only works if no token exists)
 */
app.post('/init', async (c) => {
  try {
    const body = await c.req.json<{ token: string }>();

    if (!body.token || body.token.length < 8) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Token must be at least 8 characters',
      };
      return c.json(response, 400);
    }

    if (body.token !== body.token) {
      // This check is for future when we implement confirm password
      // For now, just validate token length
    }

    const success = createToken(body.token);

    if (!success) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Token already exists. Use PUT /auth to update it.',
      };
      return c.json(response, 409);
    }

    console.log('Authentication token initialized');
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Token created successfully' },
    };
    return c.json(response, 201);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create token',
    };
    return c.json(response, 500);
  }
});

/**
 * POST /auth/verify
 * Verify a token (login)
 */
app.post('/verify', async (c) => {
  try {
    const body = await c.req.json<{ token: string }>();

    if (!body.token) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Token required',
      };
      return c.json(response, 400);
    }

    const valid = verifyToken(body.token);

    if (!valid) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid token',
      };
      return c.json(response, 401);
    }

    const response: ApiResponse<{ valid: boolean }> = {
      success: true,
      data: { valid: true },
    };
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify token',
    };
    return c.json(response, 500);
  }
});

/**
 * PUT /auth
 * Update the token (requires current token)
 */
app.put('/', async (c) => {
  try {
    const body = await c.req.json<{ currentToken: string; newToken: string }>();

    if (!body.currentToken || !body.newToken) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'currentToken and newToken are required',
      };
      return c.json(response, 400);
    }

    if (body.newToken.length < 8) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'New token must be at least 8 characters',
      };
      return c.json(response, 400);
    }

    const success = updateToken(body.currentToken, body.newToken);

    if (!success) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Current token is incorrect',
      };
      return c.json(response, 401);
    }

    console.log('Authentication token updated');
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Token updated successfully' },
    };
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update token',
    };
    return c.json(response, 500);
  }
});

/**
 * DELETE /auth
 * Delete the token (for reset)
 */
app.delete('/', async (c) => {
  try {
    const deleted = deleteToken();

    if (!deleted) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'No token exists',
      };
      return c.json(response, 404);
    }

    console.log('Authentication token deleted');
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Token deleted successfully' },
    };
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete token',
    };
    return c.json(response, 500);
  }
});

/**
 * GET /auth/reset-command
 * Returns the command to reset the token
 */
app.get('/reset-command', async (c) => {
  const tokenPath = getTokenFilePath();
  const response: ApiResponse<{ command: string }> = {
    success: true,
    data: {
      command: `rm "${tokenPath}" && bun clicast reset-token`,
    },
  };
  return c.json(response);
});

export default app;