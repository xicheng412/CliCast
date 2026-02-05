<script lang="ts">
  import { router } from '../router';
  import { sessionsStore } from '../stores/index.js';
  import type { Session, SessionStatus } from '@online-cc/types';
  import { Terminal } from 'xterm';
  import TerminalComponent from '../components/Terminal.svelte';
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
  let connected = $state(false);
  let sessionClosed = $state(false);
  let terminalReady = $state(false);
  let pendingDimensions: { cols: number; rows: number } | null = null;

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

  // Handle deep-link: if sessionId is provided but not active, try to activate it
  onMount(async () => {
    if (sessionId && currentSessionsState.activeSessionId !== sessionId) {
      const wsUrl = await sessionsStore.getWebSocketUrl(sessionId);
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
        // Send init with dimensions if terminal is ready
        if (pendingDimensions && !wsManager?.isInitialized()) {
          wsManager?.sendInit(pendingDimensions.cols, pendingDimensions.rows);
        }
      },
      onReady: (sid) => {
        console.log('[session] Terminal ready:', sid);
      },
      onOutput: (data) => {
        terminal?.write(data);
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

  // Called when Terminal component is ready with dimensions
  function handleTerminalReady(cols: number, rows: number) {
    console.log('[session] Terminal component ready:', cols, 'x', rows);
    terminalReady = true;
    pendingDimensions = { cols, rows };

    // If WebSocket is already connected, send init
    if (wsManager?.isConnected() && !wsManager.isInitialized()) {
      wsManager.sendInit(cols, rows);
    }
  }

  function handleTerminalData(data: string) {
    wsManager?.sendInput(data);
  }

  function handleResize(cols: number, rows: number) {
    wsManager?.sendResize(cols, rows);
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
    <div class="terminal-container">
      <TerminalComponent
        {terminal}
        onData={handleTerminalData}
        onResize={handleResize}
        onReady={handleTerminalReady}
      />
    </div>
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
    height: 100%;
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
