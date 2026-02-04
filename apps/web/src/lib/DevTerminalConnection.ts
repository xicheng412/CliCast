export interface DevTerminalCallbacks {
  onReady?: (isNew: boolean) => void;
  onOutput?: (data: string) => void;
  onClose?: () => void;
}

export class DevTerminalConnection {
  private ws: WebSocket | null = null;
  private callbacks: DevTerminalCallbacks;

  constructor(callbacks: DevTerminalCallbacks) {
    this.callbacks = callbacks;
  }

  connect(): void {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${location.host}/ws/dev`);

    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'ready') this.callbacks.onReady?.(msg.isNew);
      if (msg.type === 'output') this.callbacks.onOutput?.(msg.data);
    };

    this.ws.onclose = () => this.callbacks.onClose?.();
  }

  sendInit(cols: number, rows: number): void {
    this.ws?.send(JSON.stringify({ type: 'init', cols, rows }));
  }

  sendInput(data: string): void {
    this.ws?.send(JSON.stringify({ type: 'input', data }));
  }

  sendResize(cols: number, rows: number): void {
    this.ws?.send(JSON.stringify({ type: 'resize', cols, rows }));
  }

  sendKill(): void {
    this.ws?.send(JSON.stringify({ type: 'kill' }));
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
