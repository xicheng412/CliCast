# CliCast CLI

NPM package for CliCast server.

## Installation

```bash
# Install globally
npm install -g clicast

# Or run directly with npx
npx clicast
```

## Usage

```bash
# Start the server (default port 3000)
clicast

# Custom port
PORT=8080 clicast

# With custom AI command
AI_COMMAND=ollama run llama3 clicast

# Restrict allowed directories
ALLOWED_DIRS=/projects,/workspace clicast
```

Server will be available at `http://localhost:3000` (or your configured port).

## Build from Source

```bash
# Build CLI package
bun run build

# Preview package contents (dry-run)
cd packages/cli && npm pack --dry-run

# Create tarball
npm pack

# Local install test
npm install -g ./clicast-1.0.0.tgz

# Publish to npm
bun publish --access public
```

## Package Structure

```
clicast/
├── bin/clicast          # Executable entry point
├── dist/
│   ├── index.js         # Bundled server
│   ├── web/             # Frontend static files
│   └── package.json     # Dependencies
└── package.json         # Package metadata
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `AI_COMMAND` | `claude` | AI CLI command |
| `ALLOWED_DIRS` | `` | Comma-separated allowed directories |
| `TOKEN_FILE` | `.clicast-token` | Token file path |
| `BUN_IDLE_TIMEOUT` | `120` | Idle timeout in seconds |