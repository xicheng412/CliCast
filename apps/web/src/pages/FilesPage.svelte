<script lang="ts">
  import { sessionsStore } from '../stores/index.js';
  import type { Session } from '@online-cc/types';
  import { router } from '../router.js';
  import FileManager from '../components/FileManager.svelte';

  // Local state for reactive values
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

  async function handleSetActiveSession(id: string) {
    const wsUrl = await sessionsStore.getWebSocketUrl(id);
    sessionsStore.setActiveSession(id, wsUrl);
    router.navigate('/session', { sessionId: id });
  }

  function handleDeleteSession(id: string) {
    sessionsStore.delete(id);
  }
</script>

<div class="content-grid">
  <div class="sessions-panel card">
    <h3>Sessions</h3>
    {#if currentSessionsState.sessions.length === 0}
      <p class="empty-text">No active sessions</p>
      <p class="hint-text">Select a directory from the file manager to start a Claude session</p>
    {:else}
      <ul class="session-list">
        {#each currentSessionsState.sessions as session}
          <li class="session-item">
            <button
              class="session-button"
              class:active={currentSessionsState.activeSessionId === session.id}
              onclick={() => handleSetActiveSession(session.id)}
            >
              <div class="session-info">
                <span class="session-path">{session.path.split('/').pop()}</span>
                <span class="status-badge {session.status}">{session.status}</span>
              </div>
            </button>
            <button
              onclick={() => handleDeleteSession(session.id)}
              class="delete-button"
              title="Delete session"
            >
              ×
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="file-manager-panel card">
    <FileManager />
  </div>
</div>

<style>
  .content-grid {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 20px;
    padding: 20px;
    flex: 1;
    overflow: hidden;
  }

  .sessions-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sessions-panel h3 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .empty-text {
    color: #94a3b8;
    font-size: 14px;
    text-align: center;
    padding: 20px;
  }

  .hint-text {
    color: #94a3b8;
    font-size: 12px;
    text-align: center;
    padding: 0 20px 20px;
  }

  .session-list {
    list-style: none;
    flex: 1;
    overflow-y: auto;
  }

  .session-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }

  .session-button {
    flex: 1;
    display: flex;
    align-items: center;
    padding: 10px 12px;
    background: #f8fafc;
    border: 1px solid transparent;
    border-radius: 6px;
    text-align: left;
    transition: all 0.15s;
    cursor: pointer;
  }

  .session-button:hover {
    background: #f1f5f9;
  }

  .session-button.active {
    background: #e0e7ff;
    border-color: #6366f1;
  }

  .session-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .session-path {
    font-size: 13px;
    font-weight: 500;
    color: #1e293b;
  }

  .delete-button {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: #94a3b8;
    font-size: 18px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
  }

  .delete-button:hover {
    background: #fee2e2;
    color: #ef4444;
  }

  .file-manager-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  @media (max-width: 768px) {
    .content-grid {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
    }

    .sessions-panel {
      max-height: 200px;
    }
  }
</style>