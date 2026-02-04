import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, statSync } from 'fs';

import configApi from './api/config.js';
import dirsApi from './api/dirs.js';
import sessionsApi from './api/sessions.js';
import { getConfig } from './services/config.js';
import { websocketHandlers, getUpgradeData, shutdown as shutdownWs } from './services/websocket.js';
import { cleanupAllSessions } from './services/terminal.js';
import * as devTerminal from './services/devTerminal.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = new Hono();

// CORS middleware for all routes
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// API routes
app.route('/api/config', configApi);
app.route('/api/dirs', dirsApi);
app.route('/api/sessions', sessionsApi);

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// Static files handler - must come before catch-all
app.get('/assets/:path*', (c) => {
  const path = c.req.path;
  const assetName = path.replace('/assets/', '');

  const possiblePaths = [
    join(__dirname, '..', 'web', 'dist', 'assets', assetName),
    join(process.cwd(), '..', 'apps', 'web', 'dist', 'assets', assetName),
    join(__dirname, '..', '..', 'apps', 'web', 'dist', 'assets', assetName),
  ];

  for (const filePath of possiblePaths) {
    try {
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const content = readFileSync(filePath);
        const ext = extname(filePath);
        const mimeTypes: Record<string, string> = {
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.html': 'text/html',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
          '.ttf': 'font/ttf',
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        return new Response(content, {
          status: 200,
          headers: { 'Content-Type': contentType },
        });
      }
    } catch {
      // Continue to next path
    }
  }

  return new Response('Not Found', { status: 404 });
});

// Serve frontend index.html (SPA fallback)
app.get('/*', (c) => {
  const url = new URL(c.req.url);

  // API requests should not reach here
  if (url.pathname.startsWith('/api/')) {
    return c.json({ error: 'Not Found' }, 404);
  }

  // WebSocket requests should not reach here
  if (url.pathname === '/ws') {
    return c.text('WebSocket endpoint', 200);
  }

  // Try to serve from apps/web/dist (production)
  const possiblePaths = [
    join(__dirname, '..', 'web', 'dist', 'index.html'),
    join(process.cwd(), '..', 'apps', 'web', 'dist', 'index.html'),
    join(__dirname, '..', '..', 'apps', 'web', 'dist', 'index.html'),
  ];

  for (const filePath of possiblePaths) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      return new Response(content, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    } catch {
      // Try next path
    }
  }

  // If no built frontend, serve a simple status page
  try {
    const config = getConfig();
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Online Claude Code</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
    .status { background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    h1 { color: #333; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Online Claude Code</h1>
  <div class="status">
    <strong>Status:</strong> Server is running<br>
    <strong>Configuration:</strong><br>
    - Claude Command: <code>${config.claudeCommand}</code><br>
    - Allowed Directories: ${config.allowedDirs.length > 0 ? config.allowedDirs.join(', ') : 'All directories'}
  </div>
  <h2>Available Endpoints</h2>
  <ul>
    <li><code>GET /api/config</code> - Get configuration</li>
    <li><code>PUT /api/config</code> - Update configuration</li>
    <li><code>GET /api/dirs?path=xxx</code> - List directory contents</li>
    <li><code>GET /api/dirs/breadcrumbs?path=xxx</code> - Get path breadcrumbs</li>
    <li><code>GET /api/sessions</code> - List all sessions</li>
    <li><code>POST /api/sessions</code> - Create a new session (returns wsUrl)</li>
    <li><code>DELETE /api/sessions/:id</code> - Close a session</li>
    <li><code>GET /api/sessions/:id/ws</code> - Get WebSocket URL for terminal</li>
    <li><code>GET /ws?sessionId=xxx</code> - WebSocket endpoint for terminal</li>
  </ul>
</body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch {
    return c.json({ error: 'Server running but no frontend built' }, 200);
  }
});

const config = getConfig();
const idleTimeoutEnv = Number.parseInt(process.env.BUN_IDLE_TIMEOUT || '', 10);
const idleTimeoutSeconds = Number.isFinite(idleTimeoutEnv) && idleTimeoutEnv > 0 ? idleTimeoutEnv : 120;

// Start the HTTP server with WebSocket support
console.log(`Starting Online Claude Code server on port ${config.port}...`);
console.log(`Local access: http://localhost:${config.port}`);

const server = Bun.serve({
  fetch(request, server) {
    const url = new URL(request.url);

    // Handle WebSocket upgrade for /ws/dev endpoint (dev terminal)
    if (url.pathname === '/ws/dev' && request.headers.get('upgrade') === 'websocket') {
      const success = server.upgrade(request, { data: { type: 'dev' } as any });
      if (success) {
        return undefined as unknown as Response;
      }
      return new Response('WebSocket upgrade failed', { status: 500 });
    }

    // Handle WebSocket upgrade for /ws endpoint (session terminal)
    if (url.pathname === '/ws' && request.headers.get('upgrade') === 'websocket') {
      const upgradeData = getUpgradeData(request);
      if (!upgradeData) {
        return new Response('Missing sessionId parameter', { status: 400 });
      }

      const success = server.upgrade(request, { data: { ...upgradeData, type: 'session' } as any });
      if (success) {
        // Bun returns undefined on successful upgrade
        return undefined as unknown as Response;
      }
      return new Response('WebSocket upgrade failed', { status: 500 });
    }

    return app.fetch(request);
  },
  websocket: {
    open(ws: any) {
      if (ws.data.type === 'dev') {
        // Dev terminal - no action needed on open
      } else {
        websocketHandlers.open(ws);
      }
    },
    message(ws: any, message: string | Buffer) {
      if (ws.data.type === 'dev') {
        try {
          const msg = JSON.parse(message.toString());
          switch (msg.type) {
            case 'init': {
              const { isNew } = devTerminal.getOrCreate(msg.cols, msg.rows);
              const unsubscribe = devTerminal.subscribe((data) => {
                ws.send(JSON.stringify({ type: 'output', data }));
              });
              ws.data.unsubscribe = unsubscribe;
              ws.send(JSON.stringify({ type: 'ready', isNew }));
              break;
            }
            case 'input':
              devTerminal.write(msg.data);
              break;
            case 'resize':
              devTerminal.resize(msg.cols, msg.rows);
              break;
            case 'kill':
              devTerminal.kill();
              ws.send(JSON.stringify({ type: 'killed' }));
              break;
          }
        } catch (e) {
          console.error('[ws/dev] Failed to parse message:', e);
        }
      } else {
        websocketHandlers.message(ws, message);
      }
    },
    close(ws: any, code: number, reason: string) {
      if (ws.data.type === 'dev') {
        ws.data.unsubscribe?.();
      } else {
        websocketHandlers.close(ws, code, reason);
      }
    },
  } as any,
  port: config.port,
  idleTimeout: idleTimeoutSeconds,
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down...');
  cleanupAllSessions();
  await shutdownWs();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down...');
  cleanupAllSessions();
  await shutdownWs();
  process.exit(0);
});

console.log(`Server is ready!`);