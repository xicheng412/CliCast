<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { FitAddon } from 'xterm-addon-fit';
  import type { Terminal } from 'xterm';

  interface Props {
    terminal: Terminal;
    onData?: (data: string) => void;
    onResize?: (cols: number, rows: number) => void;
    onReady?: (cols: number, rows: number) => void;
  }

  let { terminal, onData, onResize, onReady }: Props = $props();

  let terminalContainer: HTMLDivElement;
  let fitAddon: FitAddon | null = null;
  let resizeObserver: ResizeObserver | null = null;

  function getDimensions(): { cols: number; rows: number } | null {
    const cols = terminal.cols;
    const rows = terminal.rows;

    if (cols > 0 && rows > 0) {
      return { cols, rows };
    }

    if (!fitAddon) return null;

    const dims = fitAddon.proposeDimensions();
    if (!dims) return null;

    return { cols: dims.cols, rows: dims.rows };
  }

  function sendResize() {
    const dims = getDimensions();
    if (dims) {
      onResize?.(dims.cols, dims.rows);
    }
  }

  onMount(() => {
    // Add fit addon
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalContainer);

    // Set up data handler
    terminal.onData((data) => {
      onData?.(data);
    });

    // Set up resize observer for fit
    resizeObserver = new ResizeObserver(() => {
      if (fitAddon) {
        fitAddon.fit();
        sendResize();
      }
    });
    resizeObserver.observe(terminalContainer);

    // Wait for layout to settle, then fit and notify ready dimensions.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (fitAddon) {
          fitAddon.fit();
          const dims = getDimensions();
          if (dims) {
            onReady?.(dims.cols, dims.rows);
            onResize?.(dims.cols, dims.rows);
          }
          terminal.focus();
        }
      });
    });
  });

  onDestroy(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });
</script>

<div class="terminal-wrapper" bind:this={terminalContainer}></div>

<style>
  .terminal-wrapper {
    flex: 1;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .terminal-wrapper :global(.xterm) {
    height: 100%;
  }

  .terminal-wrapper :global(.xterm-viewport) {
    overflow-y: auto !important;
    overflow-x: hidden !important;
  }
</style>
