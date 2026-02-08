<script lang="ts">
  import { authStore } from '../stores/index.js';
  import { router } from '../router.js';
  import { api } from '../stores/api.js';
  import type { Config, AiCommand } from '@clicast/types';
  import { onMount } from 'svelte';

  let localConfig = $state<Partial<Config>>({});
  let isLoading = $state(false);
  let isSaving = $state(false);
  let saveError = $state<string | null>(null);
  let saveSuccess = $state(false);

  // Token change state
  let showTokenChange = $state(false);
  let currentToken = $state('');
  let newToken = $state('');
  let confirmNewToken = $state('');
  let tokenError = $state<string | null>(null);
  let tokenSuccess = $state(false);
  let isChangingToken = $state(false);

  // AI Commands management state
  let newCommandName = $state('');
  let newCommandCmd = $state('');
  let editingCommand = $state<string | null>(null);
  let editCommandName = $state('');
  let editCommandCmd = $state('');

  // Use browser crypto API for UUID generation
  function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  async function loadConfig() {
    isLoading = true;
    saveError = null;
    try {
      const config = await api.getConfig();
      localConfig = { ...config };
    } catch (error) {
      saveError = error instanceof Error ? error.message : 'Failed to load config';
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    loadConfig();
  });

  async function handleSave() {
    isSaving = true;
    saveError = null;
    saveSuccess = false;

    try {
      const savedConfig = await api.updateConfig(localConfig);
      localConfig = { ...savedConfig };
      saveSuccess = true;
      setTimeout(() => (saveSuccess = false), 3000);
    } catch (error) {
      saveError = error instanceof Error ? error.message : 'Failed to save';
    } finally {
      isSaving = false;
    }
  }

  async function handleReset() {
    saveError = null;
    await loadConfig();
  }

  function addAllowedDir() {
    const newDirs = localConfig.allowedDirs || [];
    newDirs.push('');
    localConfig.allowedDirs = newDirs;
  }

  function removeAllowedDir(index: number) {
    const newDirs = localConfig.allowedDirs || [];
    newDirs.splice(index, 1);
    localConfig.allowedDirs = newDirs;
  }

  function updateAllowedDir(index: number, value: string) {
    if (localConfig.allowedDirs) {
      localConfig.allowedDirs[index] = value;
    }
  }

  // Local AI Commands management functions
  function addCommand() {
    if (!newCommandName.trim() || !newCommandCmd.trim()) return;

    const newCmd: AiCommand = {
      id: generateUUID(),
      name: newCommandName.trim(),
      cmd: newCommandCmd.trim(),
      enabled: true,
    };

    localConfig.aiCommands = [...(localConfig.aiCommands || []), newCmd];
    newCommandName = '';
    newCommandCmd = '';
  }

  function deleteCommand(id: string) {
    localConfig.aiCommands = localConfig.aiCommands?.filter((c) => c.id !== id) || [];
  }

  function toggleEnabled(id: string, enabled: boolean) {
    localConfig.aiCommands = localConfig.aiCommands?.map((c) =>
      c.id === id ? { ...c, enabled } : c
    ) || [];
  }

  function moveUp(id: string) {
    const commands = localConfig.aiCommands || [];
    const index = commands.findIndex((c) => c.id === id);
    if (index <= 0) return;

    const newCommands = [...commands];
    [newCommands[index - 1], newCommands[index]] = [newCommands[index], newCommands[index - 1]];
    localConfig.aiCommands = newCommands;
  }

  function moveDown(id: string) {
    const commands = localConfig.aiCommands || [];
    const index = commands.findIndex((c) => c.id === id);
    if (index < 0 || index >= commands.length - 1) return;

    const newCommands = [...commands];
    [newCommands[index], newCommands[index + 1]] = [newCommands[index + 1], newCommands[index]];
    localConfig.aiCommands = newCommands;
  }

  function startEditing(cmd: AiCommand) {
    editingCommand = cmd.id;
    editCommandName = cmd.name;
    editCommandCmd = cmd.cmd;
  }

  function cancelEditing() {
    editingCommand = null;
    editCommandName = '';
    editCommandCmd = '';
  }

  function saveEditing(id: string) {
    if (!editCommandName.trim() || !editCommandCmd.trim()) return;

    localConfig.aiCommands = localConfig.aiCommands?.map((c) =>
      c.id === id ? { ...c, name: editCommandName.trim(), cmd: editCommandCmd.trim() } : c
    ) || [];
    cancelEditing();
  }

  async function handleChangeToken(e: Event) {
    e.preventDefault();
    tokenError = null;
    tokenSuccess = false;

    if (newToken.length < 8) {
      tokenError = 'New token must be at least 8 characters';
      return;
    }

    if (newToken !== confirmNewToken) {
      tokenError = 'New tokens do not match';
      return;
    }

    isChangingToken = true;
    try {
      const success = await authStore.updateToken(currentToken, newToken);
      if (success) {
        tokenSuccess = true;
        // Log out after token change
        setTimeout(() => {
          authStore.logout();
          // Redirect to trigger re-authentication
          window.location.reload();
        }, 1500);
      } else {
        tokenError = 'Current token is incorrect';
      }
    } catch (error) {
      tokenError = error instanceof Error ? error.message : 'Failed to change token';
    } finally {
      isChangingToken = false;
    }
  }

  function handleLogout() {
    authStore.logout();
    router.navigate('/auth');
  }
</script>

<div class="config-panel">
  <h2>Configuration</h2>

  <div class="form-section">
    <span class="label-text">Allowed Directories</span>
    <p class="help">
      Restrict access to these directories (leave empty for no restriction).
    </p>

    {#if localConfig.allowedDirs && localConfig.allowedDirs.length > 0}
      {#each localConfig.allowedDirs as dir, i}
        <div class="dir-row">
          <input
            type="text"
            value={dir}
            onchange={(e) => updateAllowedDir(i, e.currentTarget.value)}
            placeholder="/path/to/directory"
          />
          <button onclick={() => removeAllowedDir(i)} class="btn-danger btn-sm">
            Remove
          </button>
        </div>
      {/each}
    {:else}
      <p class="empty-text">No restrictions - all directories accessible</p>
    {/if}

    <button onclick={addAllowedDir} class="btn-secondary">
      Add Directory
    </button>
  </div>

  <div class="form-section">
    <span class="label-text">AI Commands</span>
    <p class="help">
      Configure AI CLI commands. Use "claude" as default. Commands support --workdir option.
    </p>

    {#if (localConfig.aiCommands || []).length > 0}
      <div class="commands-list">
        {#each localConfig.aiCommands || [] as cmd, i (cmd.id)}
          <div class="command-row" class:disabled={!cmd.enabled}>
            {#if editingCommand === cmd.id}
              <div class="edit-form">
                <input
                  type="text"
                  bind:value={editCommandName}
                  placeholder="Command name"
                  class="name-input"
                />
                <input
                  type="text"
                  bind:value={editCommandCmd}
                  placeholder="claude"
                  class="cmd-input"
                />
                <div class="edit-actions">
                  <button onclick={() => saveEditing(cmd.id)} class="btn-primary btn-sm">
                    Save
                  </button>
                  <button onclick={cancelEditing} class="btn-secondary btn-sm">
                    Cancel
                  </button>
                </div>
              </div>
            {:else}
              <div class="command-info">
                <span class="command-name">{cmd.name}</span>
                <code class="command-cmd">{cmd.cmd}</code>
              </div>
              <div class="command-actions">
                <button
                  onclick={() => toggleEnabled(cmd.id, !cmd.enabled)}
                  class="btn-icon"
                  title={cmd.enabled ? 'Disable' : 'Enable'}
                >
                  {cmd.enabled ? '◉' : '○'}
                </button>
                <button
                  onclick={() => moveUp(cmd.id)}
                  disabled={i === 0}
                  class="btn-icon"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  onclick={() => moveDown(cmd.id)}
                  disabled={i === (localConfig.aiCommands || []).length - 1}
                  class="btn-icon"
                  title="Move down"
                >
                  ↓
                </button>
                <button onclick={() => startEditing(cmd)} class="btn-icon" title="Edit">
                  ✎
                </button>
                <button onclick={() => deleteCommand(cmd.id)} class="btn-icon btn-danger" title="Delete">
                  ×
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <p class="empty-text">No commands configured</p>
    {/if}

    <div class="add-command-form">
      <input
        type="text"
        bind:value={newCommandName}
        placeholder="Command name"
        class="name-input"
      />
      <input
        type="text"
        bind:value={newCommandCmd}
        placeholder="claude"
        class="cmd-input"
      />
      <button onclick={addCommand} class="btn-secondary" disabled={!newCommandName.trim() || !newCommandCmd.trim()}>
        Add Command
      </button>
    </div>
  </div>

  <div class="form-section">
    <label for="port">Port</label>
    <input
      id="port"
      type="number"
      bind:value={localConfig.port}
      min="1024"
      max="65535"
    />
  </div>

  <div class="actions">
    <button onclick={handleReset} class="btn-secondary" disabled={isSaving}>
      Reset
    </button>
    <button onclick={handleSave} class="btn-primary" disabled={isSaving}>
      {isSaving ? 'Saving...' : 'Save Changes'}
    </button>
  </div>

  {#if saveError}
    <div class="message error">
      {saveError}
    </div>
  {/if}

  {#if saveSuccess}
    <div class="message success">
      Configuration saved successfully!
    </div>
  {/if}
</div>

<div class="token-section">
  <h2>Authentication</h2>
  <p class="section-description">
    Change your authentication token. You will need to log in again after changing.
  </p>

  {#if !showTokenChange}
    <div class="auth-buttons">
      <button onclick={() => (showTokenChange = true)} class="btn-secondary">
        Change Token
      </button>
      <button onclick={handleLogout} class="btn-danger">
        Logout
      </button>
    </div>
  {:else}
    <form onsubmit={handleChangeToken} class="token-form">
      <div class="form-group">
        <label for="currentToken">Current Token</label>
        <input
          type="password"
          id="currentToken"
          bind:value={currentToken}
          placeholder="Enter current token"
          disabled={isChangingToken}
        />
      </div>

      <div class="form-group">
        <label for="newToken">New Token</label>
        <input
          type="password"
          id="newToken"
          bind:value={newToken}
          placeholder="At least 8 characters"
          disabled={isChangingToken}
          minlength="8"
        />
      </div>

      <div class="form-group">
        <label for="confirmNewToken">Confirm New Token</label>
        <input
          type="password"
          id="confirmNewToken"
          bind:value={confirmNewToken}
          placeholder="Confirm new token"
          disabled={isChangingToken}
          minlength="8"
        />
      </div>

      {#if tokenError}
        <div class="message error">{tokenError}</div>
      {/if}

      {#if tokenSuccess}
        <div class="message success">Token changed successfully! Please log in again.</div>
      {/if}

      <div class="token-actions">
        <button
          type="button"
          onclick={() => {
            showTokenChange = false;
            currentToken = '';
            newToken = '';
            confirmNewToken = '';
            tokenError = null;
          }}
          class="btn-secondary"
          disabled={isChangingToken}
        >
          Cancel
        </button>
        <button type="submit" class="btn-primary" disabled={isChangingToken}>
          {isChangingToken ? 'Changing...' : 'Change Token'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .config-panel {
    padding: 20px;
    max-width: 600px;
  }

  h2 {
    margin-bottom: 24px;
    font-size: 20px;
  }

  .form-section {
    margin-bottom: 24px;
  }

  label, .label-text {
    display: block;
    font-weight: 500;
    margin-bottom: 8px;
  }

  .help {
    font-size: 13px;
    color: #64748b;
    margin-top: 4px;
    margin-bottom: 8px;
  }

  .dir-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .dir-row input {
    flex: 1;
  }

  .btn-sm {
    padding: 8px 12px;
    font-size: 13px;
  }

  .empty-text {
    color: #64748b;
    font-style: italic;
    margin-bottom: 12px;
  }

  .actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
  }

  .token-section {
    margin-top: 32px;
    padding-top: 32px;
    border-top: 1px solid var(--border-color);
  }

  .token-section h2 {
    margin-bottom: 8px;
    font-size: 20px;
  }

  .section-description {
    color: var(--text-muted);
    font-size: 14px;
    margin-bottom: 16px;
  }

  .token-form {
    max-width: 400px;
  }

  .token-form .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
  }

  .token-form .form-group label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .token-actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;
  }

  .message {
    margin-top: 16px;
    padding: 12px;
    border-radius: 6px;
  }

  .message.error {
    background: #fee2e2;
    color: #991b1b;
  }

  .message.success {
    background: #dcfce7;
    color: #166534;
  }

  .auth-buttons {
    display: flex;
    gap: 12px;
  }

  .btn-danger {
    background: #ef4444;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .btn-danger:hover {
    background: #dc2626;
  }

  .btn-danger:disabled {
    background: #fca5a5;
    cursor: not-allowed;
  }

  .commands-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }

  .command-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    transition: opacity 0.2s;
  }

  .command-row.disabled {
    opacity: 0.6;
  }

  .command-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .command-name {
    font-weight: 500;
    color: #1e293b;
    white-space: nowrap;
  }

  .command-cmd {
    font-size: 12px;
    background: #e2e8f0;
    padding: 2px 8px;
    border-radius: 4px;
    color: #475569;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .command-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .btn-icon {
    background: transparent;
    border: none;
    padding: 6px 8px;
    cursor: pointer;
    font-size: 14px;
    color: #64748b;
    border-radius: 4px;
    transition: all 0.15s;
  }

  .btn-icon:hover:not(:disabled) {
    background: #e2e8f0;
    color: #1e293b;
  }

  .btn-icon:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-icon.btn-danger:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  .edit-form {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .edit-form .name-input {
    width: 120px;
  }

  .edit-form .cmd-input {
    flex: 1;
  }

  .edit-actions {
    display: flex;
    gap: 4px;
  }

  .add-command-form {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
  }

  .name-input {
    width: 140px;
  }

  .cmd-input {
    flex: 1;
  }

  .add-command-form input {
    padding: 8px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 14px;
  }

  .add-command-form input:focus {
    outline: none;
    border-color: #6366f1;
  }
</style>