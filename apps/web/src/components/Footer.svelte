<script lang="ts">
  import { configStore } from '../stores/index.js';

  let currentConfig = $derived($configStore);
</script>

<footer class="footer">
  <span>Online Claude Code</span>
  {#if currentConfig}
    <span class="config-info">
      Command: <code>{currentConfig.claudeCommand}</code>
    </span>
  {/if}
</footer>

<style>
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
</style>