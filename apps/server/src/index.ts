import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, statSync } from 'fs';

import configApi from './api/config.js';
import dirsApi from './api/dirs.js';
import sessionsApi from './api/sessions.js';
import { getConfig } from './services/config.js';

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
    <li><code>POST /api/sessions</code> - Create a new session</li>
    <li><code>DELETE /api/sessions/:id</code> - Close a session</li>
    <li><code>GET /api/sessions/:id/stream</code> - SSE stream for a session</li>
    <li><code>POST /api/sessions/:id/message</code> - Send message to session</li>
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

// Start the server
console.log(`Starting Online Claude Code server on port ${config.port}...`);
console.log(`Local access: http://localhost:${config.port}`);

Bun.serve({
  fetch: app.fetch,
  port: config.port,
  idleTimeout: idleTimeoutSeconds,
});

console.log(`Server is ready!`);
