<script lang="ts">
  import { router } from '../router';
  import { sessionsStore } from '../stores/index.js';
  import type { Session } from '@online-cc/types';
  import Terminal from '../components/Terminal.svelte';
  import { onMount } from 'svelte';

  interface Props {
    sessionId?: string;
  }

  let { sessionId }: Props = $props();

  let currentSessionsState = $state({
    sessions: [] as Session[],
    activeSessionId: null as string | null,
    activeSessionWsUrl: null as string | null,
  });

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

  // Handle deep-link: if sessionId is provided but not active, try to activate it
  onMount(async () => {
    if (sessionId && currentSessionsState.activeSessionId !== sessionId) {
      const wsUrl = await sessionsStore.getWebSocketUrl(sessionId);
      sessionsStore.setActiveSession(sessionId, wsUrl);
    }
  });

  function handleCloseTerminal() {
    if (currentSessionsState.activeSessionId) {
      sessionsStore.delete(currentSessionsState.activeSessionId);
      router.back();
    }
  }
</script>

{#if activeSession && activeWsUrl}
  <Terminal
    session={activeSession}
    wsUrl={activeWsUrl}
    onClose={handleCloseTerminal}
  />
{:else}
  <div class="no-session">
    <p>Session not found or has been closed</p>
    <button onclick={() => router.navigate('/files')} class="btn-primary">
      Back to Files
    </button>
  </div>
{/if}

<style>
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