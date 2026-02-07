import type { ClientMessage, ServerMessage, SessionStatus } from '@clicast/types';
import { authStore } from '../stores/auth.js';

export interface WebSocketCallbacks {
  onReady?: (sessionId: string) => void;
  onOutput?: (data: string) => void;
  onHistory?: (history: string[]) => void;
  onStatus?: (status: SessionStatus, sessionId: string) => void;
  onError?: (message: string) => void;
  onExit?: (code: number, signal?: number) => void;
  onConnect?: () => void;
  onDisconnect?: (code: number, reason: string) => void;
}

interface WebSocketManagerOptions {
  maxReconnectAttempts?: number;
  reconnectBaseDelay?: number;
  pingInterval?: number;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private callbacks: WebSocketCallbacks;
  private options: Required<WebSocketManagerOptions>;

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  private intentionalClose = false;

  constructor(
    wsUrl: string,
    callbacks: WebSocketCallbacks,
    options: WebSocketManagerOptions = {}
  ) {
    this.callbacks = callbacks;
    this.options = {
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      reconnectBaseDelay: options.reconnectBaseDelay ?? 1000,
      pingInterval: options.pingInterval ?? 30000,
    };

    // Append token to WebSocket URL
    const token = authStore.getToken();
    if (token) {
      const separator = wsUrl.includes('?') ? '&' : '?';
      this.wsUrl = `${wsUrl}${separator}token=${encodeURIComponent(token)}`;
    } else {
      this.wsUrl = wsUrl;
    }
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    this.intentionalClose = false;
    console.log('[ws-manager] Connecting to:', this.wsUrl);

    this.ws = new WebSocket(this.wsUrl);
    this.ws.onopen = this.handleOpen.bind(this);
    this.ws.onmessage = this.handleMessage.bind(this);
    this.ws.onclose = this.handleClose.bind(this);
    this.ws.onerror = this.handleError.bind(this);
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.stopPing();
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  sendInit(cols: number, rows: number): void {
    this.send({ type: 'init', cols, rows });
  }

  sendInput(data: string): void {
    this.send({ type: 'input', data });
  }

  sendResize(cols: number, rows: number): void {
    this.send({ type: 'resize', cols, rows });
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private send(message: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[ws-manager] Cannot send, WebSocket not open');
      return;
    }
    this.ws.send(JSON.stringify(message));
  }

  private handleOpen(): void {
    console.log('[ws-manager] Connected');
    this.reconnectAttempts = 0;
    this.callbacks.onConnect?.();
    this.startPing();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as ServerMessage;
      this.dispatchMessage(message);
    } catch (error) {
      console.error('[ws-manager] Failed to parse message:', error);
    }
  }

  private dispatchMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'ready':
        this.initialized = true;
        this.callbacks.onReady?.(message.sessionId);
        break;
      case 'output':
        this.callbacks.onOutput?.(message.data);
        break;
      case 'history':
        this.callbacks.onHistory?.(message.data);
        break;
      case 'status':
        this.callbacks.onStatus?.(message.status, message.sessionId);
        break;
      case 'error':
        this.callbacks.onError?.(message.message);
        break;
      case 'exit':
        this.callbacks.onExit?.(message.code, message.signal);
        break;
      case 'pong':
        // Heartbeat response received
        break;
    }
  }

  private handleClose(event: CloseEvent): void {
    console.log('[ws-manager] Disconnected:', event.code, event.reason);
    this.stopPing();
    this.callbacks.onDisconnect?.(event.code, event.reason);

    if (!this.intentionalClose && this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private handleError(event: Event): void {
    console.error('[ws-manager] Error:', event);
  }

  private scheduleReconnect(): void {
    const delay = this.options.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`[ws-manager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.initialized = false;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startPing(): void {
    if (this.options.pingInterval <= 0) return;

    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, this.options.pingInterval);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
