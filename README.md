# CliCast

<p align="center">
  <strong>Web interface for AI CLI Commands</strong><br>
  Access and control AI command-line tools from your browser with real-time terminal streaming
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#features">Features</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#npm-package">NPM Package</a> ·
  <a href="#development">Development</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Bun-1.1.0-black?style=for-the-badge&logo=bun" alt="Bun">
  <img src="https://img.shields.io/badge/Frontend-Svelte_5-purple?style=for-the-badge&logo=svelte" alt="Svelte">
  <img src="https://img.shields.io/badge/Backend-Hono_4.6-black?style=for-the-badge" alt="Hono">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT">
</p>

---

## What is CliCast?

CliCast is a web-based terminal interface that lets you control AI CLI tools (like Claude, Command R, and others) directly from your browser. Perfect for tablets and mobile devices on the same LAN.

**Key workflow:**
```
Browser → Select directory → AI CLI runs in terminal → Real-time output streaming
```

## Features

- 🌐 **Browser-based Terminal** — Full terminal access from any device on your network
- ⚡ **Real-time Streaming** — WebSocket for instant output
- 📱 **Mobile Friendly** — Optimized UI for tablets and phones
- 🔒 **Local First** — Runs entirely on your machine, no cloud dependencies
- 🔐 **Token Authentication** — Secure access with optional token protection
- 🎨 **Clean UI** — Modern Svelte 5 frontend with xterm.js terminal
- 🔌 **Universal AI Support** — Configure any AI CLI command

## Quick Start

```bash
# Clone and install
git clone https://github.com/yourusername/clicast.git
cd clicast
bun install

# Development (starts both server and web)
bun run dev

# Production build
bun run build
bun run start
```

Server runs at `http://localhost:3000`

## NPM Package

Install and run CliCast with a single command:

```bash
# Install globally
npm install -g clicast

# Start server
clicast
```

See [packages/cli/README.md](./packages/cli/README.md) for CLI options and environment variables.

## Usage

### Configure Your AI CLI

Edit `Settings` in the web UI to set your AI command:

| Command | Description |
|---------|-------------|
| `claude` | Anthropic Claude Code |
| `coder` | OpenAI Coder |
| `ollama run llama3` | Local Ollama models |

### Controls

| Key | Action |
|-----|--------|
| `Ctrl+C` | Interrupt AI response |
| `Ctrl+D` | End session |
| `Ctrl+L` | Clear terminal |

### Environment Variables

```bash
# Server port (default: 3000)
PORT=3000

# AI CLI command
AI_COMMAND=claude

# Allowed directories (comma-separated)
ALLOWED_DIRS=/path/to/project1,/path/to/project2

# Token file location
TOKEN_FILE=/path/to/.clicast-token

# Idle timeout (seconds)
BUN_IDLE_TIMEOUT=120
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│  ┌───────────┐  ┌───────────┐  ┌───────────────────┐   │
│  │ File Mgr  │  │ Terminal  │  │    Settings       │   │
│  └─────┬─────┘  └─────┬─────┘  └───────────────────┘   │
└────────┼──────────────┼────────────────────────────────┘
         │              │
         └────────┬─────┘
                  │ HTTPS / WebSocket
                  ▼
┌─────────────────────────────────────────────────────────┐
│                    CliCast Server                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Hono API + WebSocket Server (Bun)              │   │
│  │  ├── /api/dirs      — File browsing             │   │
│  │  ├── /api/sessions  — Session management         │   │
│  │  ├── /api/config    — Configuration              │   │
│  │  └── /api/auth      — Authentication             │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│                    bun-pty                              │
│                          ▼                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │                    PTY                           │   │
│  │  └── AI CLI Process (claude, ollama, etc.)      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Project Structure

Monorepo with two main apps:

| Directory | Purpose |
|-----------|---------|
| `apps/server/` | Hono + Bun backend API |
| `apps/web/` | Svelte + Vite frontend |
| `packages/types/` | Shared TypeScript types |
| `packages/cli/` | NPM package for distribution |

## Development

```bash
# Install dependencies
bun install

# Type checking
bun run check

# Linting
bun run lint
```

## Building NPM Package

```bash
# Build frontend + backend
bun run build

# Create npm tarball
cd packages/cli && npm pack

# Publish to npm
bun publish --access public
```

See [packages/cli/README.md](./packages/cli/README.md) for full publishing guide.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License — see [LICENSE](LICENSE) for details.