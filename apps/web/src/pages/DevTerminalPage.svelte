<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Terminal } from 'xterm';
  import { FitAddon } from 'xterm-addon-fit';
  import { DevTerminalConnection } from '../lib/DevTerminalConnection';
  import { router } from '../router';
  import 'xterm/css/xterm.css';

  let terminalEl: HTMLDivElement;
  let terminal: Terminal;
  let fitAddon: FitAddon;
  let connection: DevTerminalConnection;
  let status = $state<'connecting' | 'connected' | 'disconnected'>('connecting');

  onMount(() => {
    // Create xterm
    terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: { background: '#1e1e1e', foreground: '#ffffff' },
    });
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalEl);

    // Create connection
    connection = new DevTerminalConnection({
      onReady: () => { status = 'connected'; },
      onOutput: (data) => terminal.write(data),
      onClose: () => { status = 'disconnected'; },
    });

    // Bind input and resize
    terminal.onData((data) => connection.sendInput(data));
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (connection.isConnected()) {
        const dims = fitAddon.proposeDimensions();
        if (dims) connection.sendResize(dims.cols, dims.rows);
      }
    });
    resizeObserver.observe(terminalEl);

    // Connect and initialize
    connection.connect();
    setTimeout(() => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims) connection.sendInit(dims.cols, dims.rows);
      terminal.focus();
    }, 100);

    return () => resizeObserver.disconnect();
  });

  onDestroy(() => {
    connection?.disconnect();
    terminal?.dispose();
  });

  function handleForceExit() {
    connection?.sendKill();
    router.navigate('/files');
  }
</script>

<div class="dev-terminal-page">
  <div class="header">
    <span class="title">Dev Terminal</span>
    <div class="header-right">
      <span class="status" class:connected={status === 'connected'}>{status}</span>
      <button class="exit-btn" onclick={handleForceExit}>Force Exit</button>
    </div>
  </div>
  <div class="terminal-container" bind:this={terminalEl}></div>
</div>

<style>
  .dev-terminal-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #1e1e1e;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: #2d2d2d;
    color: #fff;
  }
  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .status {
    padding: 2px 8px;
    border-radius: 4px;
    background: #666;
    font-size: 12px;
  }
  .status.connected {
    background: #23d18b;
    color: #1e1e1e;
  }
  .exit-btn {
    padding: 4px 12px;
    border: none;
    border-radius: 4px;
    background: #e74c3c;
    color: #fff;
    font-size: 12px;
    cursor: pointer;
  }
  .exit-btn:hover {
    background: #c0392b;
  }
  .terminal-container {
    flex: 1;
    padding: 8px;
  }
</style>
