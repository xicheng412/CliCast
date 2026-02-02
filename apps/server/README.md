# Server

Hono + Bun backend for online-cc.

## Structure

```
src/
├── api/
│   ├── config.ts       # GET/PUT /api/config
│   ├── dirs.ts         # GET /api/dirs
│   └── sessions.ts     # Session CRUD + SSE stream
├── services/
│   ├── claude.ts       # Claude CLI execution
│   ├── config.ts       # Config file operations
│   └── file.ts         # File system operations
└── index.ts            # Server entry point
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sessions` | Create session |
| GET | `/api/sessions/:id` | Get session info |
| GET | `/api/sessions/:id/stream` | SSE output stream |
| POST | `/api/sessions/:id/message` | Send message |
| DELETE | `/api/sessions/:id` | Delete session |
| GET | `/api/config` | Get config |
| PUT | `/api/config` | Update config |
| GET | `/api/dirs` | List directories |

## Environment

Set `SSE_DEBUG=1` to enable SSE debugging.