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
  let mounted = false;

  function sendResize() {
    if (!fitAddon) return;

    const dims = fitAddon.proposeDimensions();
    if (dims) {
      onResize?.(dims.cols, dims.rows);
    }
  }

  function getDimensions(): { cols: number; rows: number } | null {
    if (!fitAddon) return null;
    return fitAddon.proposeDimensions() || null;
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

    // Fit after a short delay and notify ready
    setTimeout(() => {
      if (fitAddon) {
        fitAddon.fit();
        const dims = getDimensions();
        if (dims) {
          onReady?.(dims.cols, dims.rows);
        }
        terminal.focus();
      }
    }, 100);

    mounted = true;
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
    width: 100%;
    height: 100%;
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
