<script lang="ts">
  import { configStore } from '../stores/index.js';
  import type { Config } from '@online-cc/types';

  let localConfig = $state<Partial<Config>>({});
  let isSaving = $state(false);
  let saveError = $state<string | null>(null);
  let saveSuccess = $state(false);

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
</style>