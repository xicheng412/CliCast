<script lang="ts">
  import { onMount } from 'svelte';
  import { configStore, dirStore, sessionsStore } from './stores';
  import { api } from './stores/api.js';
  import FileManager from './lib/FileManager.svelte';
  import ConfigPanel from './lib/ConfigPanel.svelte';
  import ChatInterface from './lib/ChatInterface.svelte';
  import type { Session, Config } from './stores/types';

  let activeTab = $state<'files' | 'config'>('files');
  let initialized = $state(false);

  // Local state for reactive values - updated via $effect after init
  let currentSessionsState = $state({ sessions: [], activeSessionId: null as string | null });
  let currentConfigState = $state<Config | null>(null);

  function getActiveSession(): Session | null {
    const activeId = currentSessionsState.activeSessionId;
    if (!activeId) return null;
    return currentSessionsState.sessions.find((s) => s.id === activeId) || null;
  }

  const activeSession = $derived(getActiveSession());

  onMount(async () => {
    await Promise.all([
      configStore.load(),
      sessionsStore.load(),
    ]);

    // 获取 home 目录后再加载文件列表
    const home = await api.getHomeDir();
    await dirStore.navigateTo(home.path);
    initialized = true;
  });

  // Sync store changes to local state after initialization
  $effect(() => {
    if (initialized) {
      currentSessionsState = $state.snapshot($sessionsStore);
    }
  });

  $effect(() => {
    if (initialized) {
      currentConfigState = $state.snapshot($configStore);
    }
  });

  function handleSetActiveSession(id: string) {
    sessionsStore.setActiveSession(id);
  }

  function handleDeleteSession(id: string) {
    sessionsStore.delete(id);
  }
</script>

<div class="app">
  <header class="header">
    <h1>Claude Code Online</h1>
    <nav class="nav-tabs">
      <button
        class:active={activeTab === 'files'}
        onclick={() => (activeTab = 'files')}
      >
        Files
      </button>
      <button
        class:active={activeTab === 'config'}
        onclick={() => (activeTab = 'config')}
      >
        Settings
      </button>
    </nav>
  </header>

  <main class="main">
    {#if !initialized}
      <div class="loading-screen">
        <div class="spinner"></div>
        <p>Loading...</p>
      </div>
    {:else if activeSession}
      <ChatInterface session={activeSession} />
    {:else if activeTab === 'config'}
      <ConfigPanel />
    {:else}
      <div class="content-grid">
        <div class="sessions-panel card">
          <h3>Sessions</h3>
          {#if currentSessionsState.sessions.length === 0}
            <p class="empty-text">No active sessions</p>
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
    {/if}
  </main>

  <footer class="footer">
    <span>Online Claude Code</span>
    {#if currentConfigState}
      <span class="config-info">
        Command: <code>{currentConfigState.claudeCommand}</code>
      </span>
    {/if}
  </footer>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .header h1 {
    font-size: 18px;
    font-weight: 600;
    color: #1e293b;
  }

  .nav-tabs {
    display: flex;
    gap: 4px;
  }

  .nav-tabs button {
    background: transparent;
    color: #64748b;
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 500;
  }

  .nav-tabs button:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  .nav-tabs button.active {
    background: #6366f1;
    color: white;
  }

  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 16px;
    color: #64748b;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

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

  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 24px;
    background: white;
    border-top: 1px solid #e2e8f0;
    font-size: 13px;
    color: #64748b;
  }

  .config-info code {
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
    color: #6366f1;
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