<script lang="ts">
  import { onDestroy } from 'svelte';
  import { sessionsStore } from '../stores/index.js';
  import type { Session, StreamEvent } from '../stores/types.js';

  interface Props {
    session: Session;
  }

  let { session }: Props = $props();
  let sessionId = $derived(session?.id);

  let messages = $state<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  let inputMessage = $state('');
  let isSending = $state(false);
  const DEBUG_SSE =
    typeof localStorage !== 'undefined' && localStorage.getItem('debug-sse') === '1';
  const logSse = (...args: unknown[]) => {
    if (DEBUG_SSE) console.debug('[sse]', ...args);
  };

  let eventSource: EventSource | null = null;
  let activeStreamSessionId: string | null = null;
  let currentOutput = $state('');

  // Connect to SSE stream
  $effect(() => {
    if (!sessionId) return;
    if (activeStreamSessionId === sessionId && eventSource) return;
    connectToStream(sessionId);
  });

  onDestroy(() => {
    if (eventSource) {
      logSse('destroy -> close', activeStreamSessionId);
      eventSource.close();
      eventSource = null;
      activeStreamSessionId = null;
    }
  });

  function connectToStream(sessionId: string) {
    if (eventSource) {
      logSse('close previous', activeStreamSessionId);
      eventSource.close();
    }

    activeStreamSessionId = sessionId;
    eventSource = sessionsStore.createEventSource(sessionId);
    logSse('connect', sessionId);

    eventSource.onopen = () => {
      logSse('open', sessionId);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        logSse('message', data?.type);
        handleStreamEvent(data);
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      logSse('error', {
        readyState: eventSource?.readyState,
        url: eventSource?.url,
      });
    };
  }

  function handleStreamEvent(event: StreamEvent) {
    if (event.type === 'output') {
      currentOutput += event.data;
    } else if (event.type === 'error') {
      currentOutput += `[Error] ${event.data}\n`;
    } else if (event.type === 'status') {
      const statusData = JSON.parse(event.data);
      sessionsStore.updateSession({ ...session, status: statusData.status });

      if (statusData.status === 'idle' && currentOutput) {
        messages = [...messages, { role: 'assistant', content: currentOutput }];
        currentOutput = '';
      }
    }
  }

  async function sendMessage() {
    if (!inputMessage.trim() || isSending) return;

    const message = inputMessage.trim();
    inputMessage = '';
    isSending = true;

    // Add user message immediately
    messages = [...messages, { role: 'user', content: message }];
    currentOutput = '';

    try {
      await sessionsStore.sendMessage(session.id, message);
    } catch (error) {
      console.error('Failed to send message:', error);
      messages = [
        ...messages,
        { role: 'assistant', content: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}` },
      ];
    } finally {
      isSending = false;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function stopSession() {
    await sessionsStore.stop(session.id);
  }

  async function closeSession() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    await sessionsStore.delete(session.id);
  }
</script>

<div class="chat-interface">
  <div class="chat-header">
    <div class="session-info">
      <span class="session-path">{session.path}</span>
      <span class="status-badge {session.status}">{session.status}</span>
    </div>
    <div class="header-actions">
      {#if session.status === 'running'}
        <button onclick={stopSession} class="btn-secondary">Stop</button>
      {/if}
      <button onclick={closeSession} class="btn-danger">Close Session</button>
    </div>
  </div>

  <div class="chat-messages">
    {#each messages as message, i}
      <div class="message {message.role}">
        <div class="message-content">
          <pre>{message.content}</pre>
        </div>
      </div>
    {/each}

    {#if currentOutput}
      <div class="message assistant">
        <div class="message-content">
          <pre>{currentOutput}</pre>
        </div>
      </div>
    {/if}

    {#if isSending}
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    {/if}
  </div>

  <div class="chat-input">
    <textarea
      bind:value={inputMessage}
      onkeydown={handleKeyDown}
      placeholder="Type your message... (Shift+Enter for new line)"
      rows="3"
      disabled={isSending}
    ></textarea>
    <button onclick={sendMessage} class="btn-primary" disabled={!inputMessage.trim() || isSending}>
      {isSending ? 'Sending...' : 'Send'}
    </button>
  </div>
</div>

<style>
  .chat-interface {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 0;
  }

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .session-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .session-path {
    font-family: monospace;
    font-size: 13px;
    color: #64748b;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .message {
    max-width: 85%;
    border-radius: 12px;
  }

  .message.user {
    align-self: flex-end;
  }

  .message.assistant {
    align-self: flex-start;
  }

  .message-content {
    padding: 12px 16px;
  }

  .message.user .message-content {
    background: #6366f1;
    color: white;
    border-bottom-right-radius: 4px;
  }

  .message.assistant .message-content {
    background: #f1f5f9;
    color: #1e293b;
    border-bottom-left-radius: 4px;
  }

  .message-content pre {
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.6;
  }

  .typing-indicator {
    display: flex;
    gap: 4px;
    padding: 8px 16px;
    align-self: flex-start;
  }

  .typing-indicator span {
    width: 8px;
    height: 8px;
    background: #94a3b8;
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out;
  }

  .typing-indicator span:nth-child(1) {
    animation-delay: -0.32s;
  }

  .typing-indicator span:nth-child(2) {
    animation-delay: -0.16s;
  }

  @keyframes bounce {
    0%, 80%, 100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }

  .chat-input {
    padding: 16px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    gap: 12px;
    align-items: flex-end;
    background: #f8fafc;
  }

  .chat-input textarea {
    flex: 1;
    resize: none;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px;
    font-size: 14px;
    font-family: inherit;
    line-height: 1.5;
  }

  .chat-input textarea:focus {
    outline: none;
    border-color: #6366f1;
  }

  .chat-input button {
    height: fit-content;
    padding: 12px 24px;
  }
</style>
