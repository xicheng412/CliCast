# CLAUDE.md

## Overview

Web interface for accessing local Claude Code CLI from mobile/tablet devices on the same LAN.

**Workflow**: User selects a directory in browser → Server launches Claude Code in that directory → Terminal output displayed in browser.

## Tech Stack

- **Backend**: Hono + Bun + bun-pty + ws
- **Frontend**: Svelte 5 + Vite + xterm.js

## Structure

```
online-cc/
├── apps/server/src/
│   ├── index.ts        # Entry point, Bun.serve
│   ├── api/            # Routes: config, dirs, sessions
│   └── services/       # terminal, websocket, config, file
├── apps/web/src/
│   ├── App.svelte      # Main component
│   ├── lib/            # components: Terminal, FileManager, ConfigPanel
│   └── stores/         # stores + api client
└── shared/types/       # Shared types
```

## Import Conventions

```typescript
// Server
import type { ApiResponse } from '@online-cc/types';  // workspace package
import { y } from '../services/file.js';              // relative

// Web
import { z } from '$stores/api.js';                   // alias
import { x } from './stores/index.ts';                // relative
```

## Commands

```bash
bun run dev        # Both server + web
bun run build      # Production build
bun run start      # Run built server
```

## Key Conventions

- Use Svelte 5 runes: `$state`, `$derived`, `$effect`
- Use TypeScript for all files
- Wrap API responses in `ApiResponse<T>`
- Path validation via `validatePath()` before FS access
- Use `import type` for type-only imports

## Docs

- [README](./README.md) - Project overview
- [Server](./apps/server/README.md) - Backend details
- [Web](./apps/web/README.md) - Frontend details