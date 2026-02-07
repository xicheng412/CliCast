<script lang="ts">
  import { router } from './router';
  import Header from './components/Header.svelte';
  import Footer from './components/Footer.svelte';
  import FilesPage from './pages/FilesPage.svelte';
  import SettingsPage from './pages/SettingsPage.svelte';
  import SessionPage from './pages/SessionPage.svelte';
  import DevTerminalPage from './pages/DevTerminalPage.svelte';
  import { onMount } from 'svelte';
  import { configStore, sessionsStore, dirStore } from './stores';
  import { api } from './stores/api.js';
  import './styles.css';

  let initialized = $state(false);
  let routerState = $state(router.state);

  // 订阅路由变化
  $effect(() => {
    const unsub = router.subscribe((state) => {
      routerState = state;
    });
    return unsub;
  });

  onMount(async () => {
    await Promise.all([configStore.load(), sessionsStore.load()]);
    const home = await api.getHomeDir();
    await dirStore.navigateTo(home.path);
    initialized = true;
  });
</script>

<div class="app">
  <Header />
  <main class="main">
    {#if !initialized}
      <div class="loading-screen">
        <div class="spinner"></div>
        <p>Loading...</p>
      </div>
    {:else if routerState.path === '/settings'}
      <SettingsPage />
    {:else if routerState.path === '/session'}
      <SessionPage sessionId={routerState.params.sessionId} />
    {:else if routerState.path === '/dev-terminal'}
      <DevTerminalPage />
    {:else}
      <FilesPage />
    {/if}
  </main>
  <Footer />
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 16px;
    color: var(--text-muted);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e2e8f0;
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>