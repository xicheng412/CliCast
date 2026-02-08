import { Hono } from 'hono';
import { getConfig, updateConfig } from '../services/config.js';
import { authMiddleware } from '../services/auth.js';
import type { ApiResponse, Config } from '@clicast/types';

const app = new Hono();

app.use('/*', authMiddleware);

app.get('/', async (c) => {
  try {
    const config = getConfig();
    // Filter out sensitive data (auth info is checked separately via /auth/status)
    const response: ApiResponse<Config> = {
      success: true,
      data: config,
    };
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<Config> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get config',
    };
    return c.json(response, 500);
  }
});

app.put('/', async (c) => {
  try {
    const body = await c.req.json<Partial<Config>>();

    // Validate allowed dirs if provided
    if (body.allowedDirs && !Array.isArray(body.allowedDirs)) {
      const response: ApiResponse<Config> = {
        success: false,
        error: 'allowedDirs must be an array',
      };
      return c.json(response, 400);
    }

    const config = updateConfig(body);
    const response: ApiResponse<Config> = {
      success: true,
      data: config,
    };
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<Config> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update config',
    };
    return c.json(response, 500);
  }
});

export default app;