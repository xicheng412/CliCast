export interface DevTerminalCallbacks {
  onOpen?: () => void;
  onReady?: (isNew: boolean) => void;
  onOutput?: (data: string) => void;
  onError?: (error: Event | string) => void;
  onClose?: () => void;
}

export class DevTerminalConnection {
  private ws: WebSocket | null = null;
  private callbacks: DevTerminalCallbacks;
  private pendingMessages: string[] = [];

  constructor(callbacks: DevTerminalCallbacks) {
    this.callbacks = callbacks;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${location.host}/ws/dev`);

    this.ws.onopen = () => {
      this.flushPending();
      this.callbacks.onOpen?.();
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'ready') this.callbacks.onReady?.(msg.isNew);
        if (msg.type === 'output') this.callbacks.onOutput?.(msg.data);
        if (msg.type === 'error') this.callbacks.onError?.(msg.message || 'Dev terminal error');
      } catch {
        this.callbacks.onError?.('Invalid dev terminal message');
      }
    };

    this.ws.onerror = (event) => this.callbacks.onError?.(event);
    this.ws.onclose = () => this.callbacks.onClose?.();
  }

  sendInit(cols: number, rows: number): void {
    this.safeSend({ type: 'init', cols, rows });
  }

  sendInput(data: string): void {
    this.safeSend({ type: 'input', data });
  }

  sendResize(cols: number, rows: number): void {
    this.safeSend({ type: 'resize', cols, rows });
  }

  sendKill(): void {
    this.safeSend({ type: 'kill' });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.pendingMessages = [];
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private safeSend(message: object): void {
    const payload = JSON.stringify(message);

    if (!this.ws) {
      return;
    }

    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
      return;
    }

    if (this.ws.readyState === WebSocket.CONNECTING) {
      this.pendingMessages.push(payload);
      return;
    }

    this.callbacks.onError?.('Dev terminal WebSocket is not open');
  }

  private flushPending(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    for (const payload of this.pendingMessages) {
      this.ws.send(payload);
    }
    this.pendingMessages = [];
  }
}
