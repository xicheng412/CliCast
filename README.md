# online-cc

Web interface for Claude Code CLI.

## Overview

This project provides a web-based interface to interact with Claude Code CLI. It uses Server-Sent Events (SSE) to stream command output in real-time from the backend to the frontend.

## Tech Stack

- **Backend**: Hono + Bun
- **Frontend**: Svelte
- **Communication**: SSE (Server-Sent Events)

## Project Structure

```
online-cc/
├── apps/
│   ├── server/                    # Backend API (Hono + Bun)
│   └── web/                       # Frontend (Svelte + Vite)
├── shared/                        # Shared types
├── package.json                   # Root workspace config
└── bun.lock
```

详细说明：
- [Backend README](./apps/server/README.md)
- [Frontend README](./apps/web/README.md)

## Getting Started

```bash
# Install dependencies
bun install

# Development
bun run dev

# Production
bun run build && bun run start
```

Server runs at `http://localhost:3000`.

## Architecture

```
Frontend (Svelte)  ←→  SSE  ←→  Backend (Hono/Bun)
                                      ↓
                              Claude Code CLI
```

## Notes

- SSE debugging: set `SSE_DEBUG=1`