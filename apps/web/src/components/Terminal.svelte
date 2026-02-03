<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Terminal } from 'xterm';
  import { FitAddon } from 'xterm-addon-fit';
  import type { Session } from '@online-cc/types';

  interface Props {
    session: Session;
    wsUrl: string;
    onClose?: () => void;
  }

  let { session, wsUrl, onClose }: Props = $props();

  let terminalContainer: HTMLDivElement;
  let terminal: Terminal | null = null;
  let fitAddon: FitAddon | null = null;
  let ws: WebSocket | null = null;
  let connected = $state(false);
  let resizeObserver: ResizeObserver | null = null;
  let sessionClosed = $state(false);

  function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    console.log('[terminal] Connecting to WebSocket:', wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[terminal] WebSocket connected');
      connected = true;

      // Focus the terminal
      terminal?.focus();

      // Send initial resize
      if (terminal) {
        sendResize();
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (error) {
        console.error('[terminal] Failed to parse message:', error);
      }
    };

    ws.onclose = (event) => {
      console.log('[terminal] WebSocket closed:', event.code, event.reason);
      connected = false;
    };

    ws.onerror = (error) => {
      console.error('[terminal] WebSocket error:', error);
    };
  }

  function handleMessage(data: { type: string; data: unknown; sessionId?: string }) {
    if (!terminal) return;

    switch (data.type) {
      case 'connected':
        console.log('[terminal] Server acknowledged connection');
        break;
      case 'output':
        terminal.write(data.data as string);
        break;
      case 'error':
        terminal.write(`\r\n[Error] ${data.data}\r\n`);
        break;
      case 'status':
        const statusData = data.data as { status: string; sessionId?: string };
        console.log('[terminal] Status:', statusData.status);
        if (statusData.status === 'error') {
          terminal.write('\r\n[Session error]\r\n');
        }
        break;
      case 'exit':
        const exitData = data.data as { code: number; signal: number };
        console.log('[terminal] Claude exited:', exitData.code, exitData.signal);
        sessionClosed = true;
        connected = false;

        // Claude 已退出，关闭 WebSocket 和 session
        if (ws) {
          ws.close(1000, 'Session ended');
          ws = null;
        }

        // 通知父组件关闭 session
        onClose?.();
        break;
    }
  }

  function sendResize() {
    if (!ws || ws.readyState !== WebSocket.OPEN || !terminal) return;

    const dims = fitAddon?.proposedDimensions;
    if (dims) {
      ws.send(JSON.stringify({
        type: 'resize',
        sessionId: session.id,
        cols: dims.cols,
        rows: dims.rows,
      }));
    }
  }

  function handleTerminalData(data: string) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      type: 'input',
      sessionId: session.id,
      data,
    }));
  }

  onMount(() => {
    // Create terminal
    terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff',
        cursor: '#ffffff',
        cursorAccent: '#1e1e1e',
        selection: '#264f78',
        black: '#2d2d2d',
        red: '#f14c4c',
        green: '#23d18b',
        yellow: '#f5f543',
        blue: '#3b8eea',
        magenta: '#d670d6',
        cyan: '#29b7da',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b7da',
        brightWhite: '#ffffff',
      },
      convertEol: true,
    });

    // Add fit addon
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalContainer);

    // Write welcome message
    terminal.write('\r\n\x1b[1;34mStarting Claude...\x1b[0m\r\n');

    // Set up data handler
    terminal.onData((data) => {
      handleTerminalData(data);
    });

    // Connect to WebSocket
    connectWebSocket();

    // Set up resize observer for fit
    resizeObserver = new ResizeObserver(() => {
      if (fitAddon) {
        fitAddon.fit();
        sendResize();
      }
    });
    resizeObserver.observe(terminalContainer);

    // Fit after a short delay
    setTimeout(() => {
      if (fitAddon) {
        fitAddon.fit();
        sendResize();
      }
    }, 100);
  });

  onDestroy(() => {
    // Clean up
    if (ws) {
      ws.close(1000, 'Component destroyed');
    }
    if (terminal) {
      terminal.dispose();
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });
</script>

<div class="terminal-container">
  <div class="terminal-header">
    <div class="session-info">
      <span class="path">{session.path}</span>
      <span class="status" class:connected>{connected ? 'connected' : 'disconnected'}</span>
    </div>
    <div class="header-actions">
      {#if onClose}
        <button onclick={onClose} class="close-button">Close Session</button>
      {/if}
    </div>
  </div>
  <div class="terminal-wrapper" bind:this={terminalContainer}></div>
</div>

<style>
  .terminal-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1e1e1e;
  }

  .terminal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: #2d2d2d;
    border-bottom: 1px solid #3d3d3d;
  }

  .session-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .path {
    font-family: monospace;
    font-size: 13px;
    color: #aaa;
  }

  .status {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 4px;
    background: #4a4a4a;
    color: #aaa;
  }

  .status.connected {
    background: #23d18b;
    color: #1e1e1e;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .close-button {
    background: transparent;
    border: 1px solid #666;
    color: #aaa;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .close-button:hover {
    background: #4a4a4a;
    color: #fff;
  }

  .terminal-wrapper {
    flex: 1;
    overflow: hidden;
    padding: 8px;
  }

  .terminal-wrapper :global(.xterm) {
    height: 100%;
  }

  .terminal-wrapper :global(.xterm-viewport) {
    overflow-y: auto !important;
  }
</style>