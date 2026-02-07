<script lang="ts">
  import { configStore, authStore } from '../stores/index.js';
  import { router } from '../router.js';
  import type { Config } from '@online-cc/types';

  let localConfig = $state<Partial<Config>>({});
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

  // Reactive store access with $ prefix
  let currentConfig = $derived($configStore);

  // Load config on mount
  $effect(() => {
    if (currentConfig) {
      localConfig = { ...currentConfig };
    } else {
      configStore.load();
    }
  });

  // Sync with store
  $effect(() => {
    if (currentConfig) {
      localConfig = { ...currentConfig };
    }
  });

  async function handleSave() {
    isSaving = true;
    saveError = null;
    saveSuccess = false;

    try {
      await configStore.update(localConfig);
      saveSuccess = true;
      setTimeout(() => (saveSuccess = false), 3000);
    } catch (error) {
      saveError = error instanceof Error ? error.message : 'Failed to save';
    } finally {
      isSaving = false;
    }
  }

  function handleReset() {
    if (currentConfig) {
      localConfig = { ...currentConfig };
    }
    saveError = null;
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
    <label for="claudeCommand">Claude Command</label>
    <input
      id="claudeCommand"
      type="text"
      bind:value={localConfig.claudeCommand}
      placeholder="claude"
    />
    <p class="help">
      The command used to start Claude Code. Default is "claude".
    </p>
  </div>

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
</style>