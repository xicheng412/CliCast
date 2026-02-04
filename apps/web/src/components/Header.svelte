<script lang="ts">
  import { router } from '../router';

  let currentPath = $state(router.state.path);

  $effect(() => {
    const unsub = router.subscribe((state) => {
      currentPath = state.path;
    });
    return unsub;
  });
</script>

<header class="header">
  <h1>Claude Code Online</h1>
  <nav class="nav-tabs">
    <button
      class:active={currentPath === '/files'}
      onclick={() => router.navigate('/files')}
    >
      Files
    </button>
    <button
      class:active={currentPath === '/dev-terminal'}
      onclick={() => router.navigate('/dev-terminal')}
    >
      Terminal
    </button>
    <button
      class:active={currentPath === '/settings'}
      onclick={() => router.navigate('/settings')}
    >
      Settings
    </button>
  </nav>
</header>

<style>
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
</style>