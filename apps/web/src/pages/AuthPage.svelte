<script lang="ts">
  import { authStore } from '../stores/auth.js';
  import type { ComponentType } from 'svelte';

  interface Props {
    onAuthenticated?: () => void;
  }

  let { onAuthenticated }: Props = $props();

  let mode = $state<'init' | 'login'>('init');
  let token = $state('');
  let confirmToken = $state('');
  let currentToken = $state('');
  let newToken = $state('');
  let confirmNewToken = $state('');
  let error = $state('');
  let loading = $state(false);

  // Check if we're in init mode (no token exists on server)
  async function checkMode() {
    loading = true;
    error = '';
    try {
      await authStore.checkStatus();
      // Check store state for hasToken (set by checkStatus)
      const hasToken = authStore.getState().hasToken;
      if (hasToken) {
        // Server has token configured, show login mode
        mode = 'login';
      } else {
        // No token on server, show init mode
        mode = 'init';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to check auth status';
      // Default to init mode on error
      mode = 'init';
    } finally {
      loading = false;
    }
  }

  // Handle init token (first-time setup)
  async function handleInit(e: Event) {
    e.preventDefault();
    error = '';

    if (token.length < 8) {
      error = 'Token must be at least 8 characters';
      return;
    }

    if (token !== confirmToken) {
      error = 'Tokens do not match';
      return;
    }

    loading = true;
    try {
      const success = await authStore.init(token);
      if (success) {
        onAuthenticated?.();
      } else {
        error = 'Failed to create token';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to create token';
    } finally {
      loading = false;
    }
  }

  // Handle login
  async function handleLogin(e: Event) {
    e.preventDefault();
    error = '';

    if (!token) {
      error = 'Please enter your token';
      return;
    }

    loading = true;
    try {
      const success = await authStore.verify(token);
      if (success) {
        onAuthenticated?.();
      } else {
        error = 'Invalid token';
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Invalid token';
    } finally {
      loading = false;
    }
  }

  // Initialize on mount
  $effect(() => {
    checkMode();
  });
</script>

<div class="auth-page">
  <div class="auth-card">
    <div class="logo">
      <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    </div>

    <h1>CliCast</h1>

    {#if loading && mode === 'init' && !token}
      <p class="loading-text">Checking authentication status...</p>
    {:else if mode === 'init'}
      <p class="subtitle">Create your authentication token</p>

      <form onsubmit={handleInit}>
        <div class="form-group">
          <label for="token">Token</label>
          <input
            type="password"
            id="token"
            bind:value={token}
            placeholder="At least 8 characters"
            disabled={loading}
            minlength="8"
          />
        </div>

        <div class="form-group">
          <label for="confirmToken">Confirm Token</label>
          <input
            type="password"
            id="confirmToken"
            bind:value={confirmToken}
            placeholder="Confirm your token"
            disabled={loading}
            minlength="8"
          />
        </div>

        {#if error}
          <div class="error">{error}</div>
        {/if}

        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Token'}
        </button>
      </form>
    {:else if mode === 'login'}
      <p class="subtitle">Enter your token to continue</p>

      <form onsubmit={handleLogin}>
        <div class="form-group">
          <label for="token">Token</label>
          <input
            type="password"
            id="token"
            bind:value={token}
            placeholder="Enter your token"
            disabled={loading}
          />
        </div>

        {#if error}
          <div class="error">{error}</div>
        {/if}

        <button type="submit" disabled={loading}>
          {loading ? 'Verifying...' : 'Login'}
        </button>
      </form>
    {:else}
      <p class="loading-text">Loading...</p>
    {/if}
  </div>
</div>

<style>
  .auth-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    padding: 20px;
    background: var(--bg-primary);
  }

  .auth-card {
    width: 100%;
    max-width: 400px;
    padding: 40px;
    background: var(--bg-secondary);
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
    text-align: center;
  }

  .logo {
    color: var(--primary-color);
    margin-bottom: 16px;
  }

  h1 {
    margin: 0 0 8px;
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .subtitle {
    margin: 0 0 24px;
    font-size: 14px;
    color: var(--text-muted);
  }

  .loading-text {
    color: var(--text-muted);
    font-size: 14px;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    text-align: left;
  }

  label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  input {
    padding: 12px 16px;
    font-size: 16px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    outline: none;
    transition: border-color 0.2s;
  }

  input:focus {
    border-color: var(--primary-color);
  }

  input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  button {
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 500;
    border: none;
    border-radius: 8px;
    background: var(--primary-color);
    color: white;
    cursor: pointer;
    transition: opacity 0.2s;
    margin-top: 8px;
  }

  button:hover:not(:disabled) {
    opacity: 0.9;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error {
    padding: 12px 16px;
    font-size: 14px;
    color: #dc2626;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    text-align: left;
  }
</style>