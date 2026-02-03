// Use globalThis to check browser environment (works in Vite/Bun without SvelteKit)
const browser = typeof window !== 'undefined';

export type RouteParams = {
  sessionId?: string;
};

type RouterState = {
  path: string;
  params: RouteParams;
};

let currentState: RouterState = { path: '/files', params: {} };
const listeners: Set<(state: RouterState) => void> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener(currentState));
}

// URL <-> State 同步
function parseUrl(): RouterState {
  if (!browser) return { path: '/files', params: {} };

  const hash = window.location.hash.slice(1) || '/files';
  const params: RouteParams = {};

  if (hash.startsWith('/session/')) {
    params.sessionId = hash.split('/')[2];
  }

  return { path: hash.startsWith('/session/') ? '/session' : hash, params };
}

function updateUrl(path: string, params?: RouteParams) {
  if (!browser) return;

  let hash = path;
  if (path === '/session' && params?.sessionId) {
    hash = `/session/${params.sessionId}`;
  }

  if (window.location.hash.slice(1) !== hash) {
    window.location.hash = hash;
  }
}

// 初始化时同步 URL -> State
if (browser) {
  currentState = parseUrl();
  window.addEventListener('hashchange', () => {
    currentState = parseUrl();
    notifyListeners();
  });
}

export const router = {
  get state() {
    return currentState;
  },

  subscribe(listener: (state: RouterState) => void) {
    listeners.add(listener);
    listener(currentState); // 立即触发一次
    return () => listeners.delete(listener);
  },

  navigate(path: string, params?: RouteParams) {
    currentState = { path, params: params || {} };
    updateUrl(path, params);
    notifyListeners();
  },

  back() {
    this.navigate('/files');
  },

  getParam(key: keyof RouteParams): string | undefined {
    return currentState.params[key];
  },
};