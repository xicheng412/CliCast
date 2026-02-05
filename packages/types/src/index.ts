// API 响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 会话类型
export interface Session {
  id: string;
  createdAt: string;
  status: 'active' | 'closed';
}

// WebSocket 消息类型
export interface WsMessage {
  type: 'output' | 'input' | 'status' | 'error';
  payload: unknown;
  sessionId?: string;
}

// 终端配置类型
export interface TerminalConfig {
  rows: number;
  cols: number;
  cursorBlink: boolean;
  fontSize: number;
  fontFamily: string;
}

// API 错误类型
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}