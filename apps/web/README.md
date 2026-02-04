# Web

Svelte + Vite frontend for online-cc.

## Structure

```
src/
├── lib/
│   ├── ChatInterface.svelte      # Main chat UI
│   ├── ConfigPanel.svelte        # Settings panel
│   ├── DevTerminalConnection.ts  # Dev terminal WebSocket client
│   └── FileManager.svelte        # File browser
├── pages/
│   └── DevTerminalPage.svelte    # Dev terminal page
├── stores/
│   ├── api.ts                    # API client
│   ├── index.ts                  # State stores
│   └── types.ts                  # Type definitions
├── App.svelte                    # Root component
├── app.css                       # Styles
└── main.ts                       # Entry point
```

## Development

```bash
bun install
bun run dev
```

## Build

```bash
bun run build
```

Output goes to server's `public/` directory.