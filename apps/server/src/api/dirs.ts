import { Hono } from 'hono';
import { listDir, getBreadcrumbs, getRootDirs, getHomeDir, validatePath } from '../services/file.js';
import { getConfig } from '../services/config.js';
import type { ApiResponse, DirResponse, Breadcrumb } from '@online-cc/types';

const app = new Hono();

app.get('/', async (c) => {
  try {
    const path = c.req.query('path');
    const config = getConfig();

    if (!path) {
      // Return root directories
      const roots = getRootDirs();
      const entries = roots.map((rootPath) => ({
        name: rootPath === '/' ? 'Root' : rootPath.split('/').pop() || rootPath,
        path: rootPath,
        type: 'directory' as const,
      }));

      const response: ApiResponse<DirResponse> = {
        success: true,
        data: {
          path: '/',
          entries,
        },
      };
      return c.json(response);
    }

    // Validate path
    if (!validatePath(path, config.allowedDirs)) {
      const response: ApiResponse<DirResponse> = {
        success: false,
        error: 'Access to this directory is not allowed',
      };
      return c.json(response, 403);
    }

    const dirResponse = listDir(path);
    const response: ApiResponse<DirResponse> = {
      success: true,
      data: dirResponse,
    };
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<DirResponse> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read directory',
    };
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    return c.json(response, status);
  }
});

app.get('/breadcrumbs', async (c) => {
  try {
    const path = c.req.query('path');
    const config = getConfig();

    if (!path) {
      const response: ApiResponse<Breadcrumb[]> = {
        success: true,
        data: [],
      };
      return c.json(response);
    }

    if (!validatePath(path, config.allowedDirs)) {
      const response: ApiResponse<Breadcrumb[]> = {
        success: false,
        error: 'Access to this directory is not allowed',
      };
      return c.json(response, 403);
    }

    const breadcrumbs = getBreadcrumbs(path);
    const response: ApiResponse<Breadcrumb[]> = {
      success: true,
      data: breadcrumbs,
    };
    return c.json(response);
  } catch (error) {
    const response: ApiResponse<Breadcrumb[]> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get breadcrumbs',
    };
    return c.json(response, 500);
  }
});

app.get('/home', async (c) => {
  const homeDir = getHomeDir();
  const response: ApiResponse<{ path: string }> = {
    success: true,
    data: { path: homeDir },
  };
  return c.json(response);
});

export default app;