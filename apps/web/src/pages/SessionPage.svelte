<script lang="ts">
  import { router } from '../router';
  import { sessionsStore } from '../stores/index.js';
  import type { Session, SessionStatus } from '@clicast/types';
  import { Terminal } from 'xterm';
  import { FitAddon } from 'xterm-addon-fit';
  import { WebSocketManager } from '../lib/WebSocketManager';
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    sessionId?: string;
  }

  let { sessionId }: Props = $props();

  let currentSessionsState = $state({
    sessions: [] as Session[],
    activeSessionId: null as string | null,
    activeSessionWsUrl: null as string | null,
  });

  let terminal: Terminal | null = $state(null);
  let wsManager: WebSocketManager | null = null;
  let fitAddon: FitAddon | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let terminalEl: HTMLDivElement | null = $state(null);
  let terminalInitialized = $state(false);

  let connected = $state(false);
  let sessionClosed = $state(false);
  let terminalReady = $state(false);
  let pendingDimensions: { cols: number; rows: number } | null = null;

  function getCurrentDimensions(
    fallback?: { cols: number; rows: number }
  ): { cols: number; rows: number } | null {
    const cols = terminal?.cols ?? pendingDimensions?.cols ?? fallback?.cols ?? 0;
    const rows = terminal?.rows ?? pendingDimensions?.rows ?? fallback?.rows ?? 0;

    if (cols > 0 && rows > 0) {
      return { cols, rows };
    }

    const dims = fitAddon?.proposeDimensions();
    if (dims) {
      return { cols: dims.cols, rows: dims.rows };
    }

    return null;
  }

  function syncTerminalSize() {
    if (!fitAddon) return;

    fitAddon.fit();

    const dims = getCurrentDimensions();
    if (!dims) return;

    pendingDimensions = dims;
    terminalReady = true;

    if (wsManager?.isConnected()) {
      if (wsManager.isInitialized()) {
        wsManager.sendResize(dims.cols, dims.rows);
      } else {
        wsManager.sendInit(dims.cols, dims.rows);
      }
    }
  }

  function getActiveSession(): Session | null {
    const activeId = currentSessionsState.activeSessionId;
    if (!activeId) return null;
    return currentSessionsState.sessions.find((s) => s.id === activeId) || null;
  }

  const activeSession = $derived(getActiveSession());
  const activeWsUrl = $derived(currentSessionsState.activeSessionWsUrl);

  // Sync store changes to local state
  $effect(() => {
    const snapshot = $state.snapshot($sessionsStore);
    currentSessionsState = {
      sessions: snapshot.sessions,
      activeSessionId: snapshot.activeSessionId,
      activeSessionWsUrl: snapshot.activeSessionWsUrl,
    };
  });

  // Connect WebSocket when URL is available and terminal is ready
  $effect(() => {
    const wsUrl = currentSessionsState.activeSessionWsUrl;
    if (wsUrl && terminalReady && !wsManager) {
      connectWebSocket(wsUrl);
    }
  });

  // Open xterm directly in session container (same structure as dev terminal page)
  $effect(() => {
    if (!terminal || !terminalEl || terminalInitialized) {
      return;
    }

    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalEl);

    terminal.onData((data) => {
      wsManager?.sendInput(data);
    });

    resizeObserver = new ResizeObserver(() => {
      syncTerminalSize();
    });
    resizeObserver.observe(terminalEl);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        syncTerminalSize();
        terminal?.focus();
      });
    });

    terminalInitialized = true;
  });

  // Handle deep-link: if sessionId is provided but not active, try to activate it
  onMount(async () => {
    if (sessionId && currentSessionsState.activeSessionId !== sessionId) {
      // Construct WebSocket URL using browser's location.host for correct LAN access
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${location.host}/ws?sessionId=${sessionId}`;
      sessionsStore.setActiveSession(sessionId, wsUrl);
    }

    // Initialize terminal
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
  });

  onDestroy(() => {
    resizeObserver?.disconnect();

    if (wsManager) {
      wsManager.disconnect();
      wsManager = null;
    }
    if (terminal) {
      terminal.dispose();
      terminal = null;
    }
  });

  function connectWebSocket(wsUrl: string) {
    wsManager = new WebSocketManager(wsUrl, {
      onConnect: () => {
        console.log('[session] WebSocket connected');
        connected = true;

        if (!wsManager?.isInitialized()) {
          const dims = getCurrentDimensions();
          if (dims) {
            wsManager?.sendInit(dims.cols, dims.rows);
          }
        }
      },
      onReady: (sid) => {
        console.log('[session] Terminal ready:', sid);

        const dims = getCurrentDimensions();
        if (dims) {
          wsManager?.sendResize(dims.cols, dims.rows);
        }
      },
      onOutput: (data) => {
        terminal?.write(data);
      },
      onHistory: (history) => {
        for (const line of history) {
          terminal?.write(line);
        }
      },
      onStatus: (status: SessionStatus) => {
        console.log('[session] Status:', status);
        switch (status) {
          case 'exited':
            terminal?.write('\r\n[Session exited]\r\n');
            break;
          case 'terminated':
            terminal?.write('\r\n[Session terminated]\r\n');
            break;
          case 'created':
            terminal?.write('\r\n[Session created]\r\n');
            break;
        }
      },
      onError: (message) => {
        console.error('[session] Error:', message);
        terminal?.write(`\r\n[Error] ${message}\r\n`);
      },
      onExit: (code, signal) => {
        console.log('[session] Claude exited:', code, signal);
        sessionClosed = true;
        connected = false;
      },
      onDisconnect: (code, reason) => {
        console.log('[session] Disconnected:', code, reason);
        connected = false;
      },
    });

    wsManager.connect();
  }

  function handleCloseTerminal() {
    if (currentSessionsState.activeSessionId) {
      sessionsStore.delete(currentSessionsState.activeSessionId);
      router.back();
    }
  }
</script>

{#if activeSession && activeWsUrl && terminal}
  <div class="session-page">
    <div class="session-header">
      <div class="session-info">
        <span class="path">{activeSession.path}</span>
        <span class="status" class:connected={connected && !sessionClosed}>
          {sessionClosed ? 'closed' : (connected ? 'connected' : 'connecting...')}
        </span>
      </div>
      <div class="header-actions">
        <button onclick={handleCloseTerminal} class="close-button">Close Session</button>
      </div>
    </div>
    <div class="terminal-container" bind:this={terminalEl}></div>
  </div>
{:else}
  <div class="no-session">
    <p>Session not found or has been closed</p>
    <button onclick={() => router.navigate('/files')} class="btn-primary">
      Back to Files
    </button>
  </div>
{/if}

<style>
  .session-page {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: #1e1e1e;
  }

  .session-header {
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

  .terminal-container {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .no-session {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 16px;
    color: #64748b;
  }
</style>
