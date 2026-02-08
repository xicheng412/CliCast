<script lang="ts">
  import { dirStore, sessionsStore, recentPathsStore, configStore } from '../stores/index.js';
  import { api } from '../stores/api.js';
  import { router } from '../router.js';
  import type { AiCommand } from '@clicast/types';

  let selectedPath = $state<string | null>(null);
  let isCreatingSession = $state(false);
  let showCommandDropdown = $state(false);

  // Get enabled commands for dropdown (from configStore)
  let enabledCommands = $derived($configStore?.aiCommands.filter((c) => c.enabled) || []);

  // Access store directly with $ prefix in the script
  function getCurrentDir() {
    return $dirStore;
  }

  function getDisplayName(entry: { name: string; type: string }): string {
    if (entry.type === 'directory') {
      return entry.name;
    }
    // Hide hidden files except .env
    if (entry.name.startsWith('.') && entry.name !== '.env') {
      return '';
    }
    return entry.name;
  }

  function handleEntryClick(entry: { path: string; type: string }) {
    if (entry.type === 'directory') {
      selectedPath = null;
      dirStore.navigateTo(entry.path);
    } else {
      selectedPath = entry.path;
    }
  }

  function handleDoubleClick(entry: { path: string; type: string }) {
    if (entry.type === 'directory') {
      selectedPath = null;
      dirStore.navigateTo(entry.path);
    }
  }

  function handlePathClick(path: string) {
    selectedPath = null;
    dirStore.navigateTo(path);
  }

  function handleRemoveRecentPath(e: MouseEvent, path: string) {
    e.stopPropagation();
    recentPathsStore.removePath(path);
  }

  async function handleLoadDirectory(aiCommandId?: string) {
    const path = $dirStore.currentPath || '/';
    isCreatingSession = true;
    showCommandDropdown = false;
    try {
      const session = await sessionsStore.create(path, aiCommandId);
      if (session) {
        console.log('Session created:', session.id);
        recentPathsStore.addPath(path);

        // Navigate to session page - WebSocket will connect there
        router.navigate('/session', { sessionId: session.id });
      }
    } finally {
      isCreatingSession = false;
    }
  }

  async function handleLoadWithCommand(cmd: AiCommand) {
    await handleLoadDirectory(cmd.id);
  }

  function toggleDropdown() {
    showCommandDropdown = !showCommandDropdown;
  }

  async function handleGoHome() {
    selectedPath = null;
    try {
      const home = await api.getHomeDir();
      dirStore.navigateTo(home.path);
    } catch (error) {
      console.error('Failed to get home directory:', error);
    }
  }

  function formatSize(size?: number): string {
    if (!size) return '-';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

<div class="file-manager">
  <div class="toolbar">
    <div class="toolbar-left">
      <button onclick={handleGoHome} class="btn-secondary">Home</button>
    </div>
    <div class="toolbar-right">
      <div class="dropdown">
        <button
          onclick={toggleDropdown}
          class="btn-primary"
          disabled={!$dirStore.currentPath || isCreatingSession}
        >
          {isCreatingSession ? 'Loading...' : 'Load This Directory ▼'}
        </button>
        {#if showCommandDropdown && enabledCommands.length > 0}
          <div class="dropdown-menu">
            {#each enabledCommands as cmd}
              <button onclick={() => handleLoadWithCommand(cmd)} class="dropdown-item">
                {cmd.name}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>

  {#if $recentPathsStore.length > 0}
    <div class="recent-paths">
      <span class="recent-label">Recent:</span>
      {#each $recentPathsStore as path}
        <button
          class="recent-path-chip"
          onclick={() => handlePathClick(path)}
          title={path}
        >
          {path.split('/').pop() || path}
          <span
            class="remove-btn"
            onclick={(e) => handleRemoveRecentPath(e, path)}
          >×</span>
        </button>
      {/each}
      <button
        class="clear-btn"
        onclick={() => recentPathsStore.clear()}
        title="Clear recent paths"
      >Clear</button>
    </div>
  {/if}

  <div class="path-bar">
    <button onclick={() => handlePathClick('/')} class="path-item">Root</button>
    {#each $dirStore.breadcrumbs as crumb}
      <span class="separator">/</span>
      <button onclick={() => handlePathClick(crumb.path)} class="path-item">
        {crumb.name}
      </button>
    {/each}
  </div>

  {#if $dirStore.error}
    <div class="error-message">
      {$dirStore.error}
      <button onclick={() => dirStore.clearError()} class="btn-secondary">Dismiss</button>
    </div>
  {/if}

  {#if $dirStore.loading}
    <div class="loading">Loading...</div>
  {:else if $dirStore.entries}
    <div class="file-list">
      <div class="list-header">
        <span class="col-name">Name</span>
        <span class="col-type">Type</span>
        <span class="col-size">Size</span>
      </div>
      <div class="list-body">
        {#each $dirStore.entries as entry}
          {@const displayName = getDisplayName(entry)}
          {#if displayName}
            <div
              class="list-row"
              class:selected={selectedPath === entry.path}
              class:directory={entry.type === 'directory'}
              onclick={() => handleEntryClick(entry)}
              ondblclick={() => handleDoubleClick(entry)}
              onkeydown={(e) => e.key === 'Enter' && handleDoubleClick(entry)}
              tabindex="0"
              role="button"
            >
              <span class="col-name">
                {#if entry.type === 'directory'}
                  <span class="icon">📁</span>
                {:else}
                  <span class="icon">📄</span>
                {/if}
                {entry.name}
              </span>
              <span class="col-type">{entry.type}</span>
              <span class="col-size">{formatSize(entry.size)}</span>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {:else}
    <div class="empty-state">Select a directory to browse</div>
  {/if}
</div>

<style>
  .file-manager {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 12px;
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .toolbar-left,
  .toolbar-right {
    display: flex;
    gap: 8px;
  }

  .recent-paths {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 0;
    flex-wrap: wrap;
  }

  .recent-label {
    font-size: 12px;
    color: #64748b;
    font-weight: 500;
  }

  .recent-path-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    font-size: 12px;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s;
  }

  .recent-path-chip:hover {
    background: #e2e8f0;
    border-color: #cbd5e1;
  }

  .remove-btn {
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 14px;
    cursor: pointer;
    border-radius: 50%;
  }

  .remove-btn:hover {
    background: #cbd5e1;
    color: #475569;
  }

  .clear-btn {
    padding: 4px 8px;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 12px;
    cursor: pointer;
  }

  .clear-btn:hover {
    color: #ef4444;
  }

  .path-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    background: #f8fafc;
    border-radius: 6px;
    font-size: 14px;
    flex-wrap: wrap;
  }

  .path-item {
    background: none;
    border: none;
    padding: 2px 6px;
    cursor: pointer;
    color: #6366f1;
    font-size: 14px;
  }

  .path-item:hover {
    background: #e2e8f0;
    border-radius: 4px;
  }

  .separator {
    color: #94a3b8;
  }

  .error-message {
    padding: 12px;
    background: #fee2e2;
    color: #991b1b;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .loading,
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: #64748b;
  }

  .file-list {
    flex: 1;
    overflow: auto;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }

  .list-header {
    display: flex;
    padding: 10px 12px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    font-weight: 500;
    font-size: 13px;
    color: #64748b;
    position: sticky;
    top: 0;
  }

  .list-body {
    overflow-y: auto;
  }

  .list-row {
    display: flex;
    padding: 8px 12px;
    border-bottom: 1px solid #f1f5f9;
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .list-row:hover {
    background: #f8fafc;
  }

  .list-row.selected {
    background: #e0e7ff;
  }

  .list-row:focus {
    outline: 2px solid #6366f1;
    outline-offset: -2px;
  }

  .list-row.directory {
    font-weight: 500;
  }

  .col-name {
    flex: 2;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .col-type {
    width: 80px;
    color: #64748b;
    font-size: 13px;
  }

  .col-size {
    width: 80px;
    text-align: right;
    color: #64748b;
    font-size: 13px;
    font-family: monospace;
  }

  .icon {
    font-size: 16px;
  }

  .dropdown {
    position: relative;
    display: inline-block;
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    min-width: 160px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 100;
    display: flex;
    flex-direction: column;
  }

  .dropdown-item {
    background: none;
    border: none;
    padding: 10px 16px;
    text-align: left;
    cursor: pointer;
    font-size: 14px;
    color: #1e293b;
    transition: background-color 0.15s;
  }

  .dropdown-item:hover {
    background: #f1f5f9;
  }

  .dropdown-item:first-child {
    border-radius: 6px 6px 0 0;
  }

  .dropdown-item:last-child {
    border-radius: 0 0 6px 6px;
  }
</style>