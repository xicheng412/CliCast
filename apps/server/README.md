# Server

Hono + Bun backend for CliCast.

## Structure

```
src/
├── api/
│   ├── config.ts       # GET/PUT /api/config
│   ├── dirs.ts         # GET /api/dirs
│   └── sessions.ts     # Session CRUD + WebSocket stream
├── services/
│   ├── aiCommand.ts    # AI CLI execution
│   ├── config.ts       # Config file operations
│   ├── devTerminal.ts  # Dev terminal PTY management
│   └── file.ts         # File system operations
└── index.ts            # Server entry point
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sessions` | Create session |
| GET | `/api/sessions/:id` | Get session info |
| GET | `/api/sessions/:id/ws` | Get WebSocket URL for session |
| POST | `/api/sessions/:id/message` | Send message |
| DELETE | `/api/sessions/:id` | Delete session |
| GET | `/api/config` | Get config |
| PUT | `/api/config` | Update config |
| GET | `/api/dirs` | List directories |

## WebSocket Endpoints

| Endpoint | Description |
|----------|-------------|
| `/ws?sessionId=xxx` | Session terminal WebSocket |
| `/ws/dev` | Dev terminal WebSocket (single shared instance) |

## Environment

No special environment variables for WebSocket.