import { writable, get } from 'svelte/store';
import { api, setAuthToken } from './api.js';

const TOKEN_KEY = 'online-cc-token';

interface AuthState {
  token: string | null;
  hasToken: boolean | null; // null = not checked yet
  authenticated: boolean;
}

function createAuthStore() {
  // Load token from localStorage
  function loadStoredToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  // Save token to localStorage
  function saveToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  // Remove token from localStorage
  function removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  const { subscribe, set, update }: import('svelte/store').Writable<AuthState> = writable({
    token: loadStoredToken(),
    hasToken: null,
    authenticated: false,
  });

  return {
    subscribe,

    /**
     * Check if server has a token configured
     */
    async checkStatus(): Promise<boolean> {
      try {
        const response = await api.checkAuthStatus();
        const hasToken = response.hasToken;

        update((state) => ({ ...state, hasToken }));

        // If no token exists on server, we're not authenticated
        if (!hasToken) {
          update((state) => ({ ...state, authenticated: false }));
          return false;
        }

        // If server has token but we have stored token, verify it
        const storedToken = loadStoredToken();
        if (storedToken) {
          try {
            await api.verifyToken(storedToken);
            setAuthToken(storedToken);
            update((state) => ({ ...state, authenticated: true }));
            return true;
          } catch {
            // Token verification failed
            removeToken();
            update((state) => ({
              ...state,
              token: null,
              authenticated: false,
            }));
            return false;
          }
        }

        // Server has token but we don't have it stored
        update((state) => ({ ...state, authenticated: false }));
        return false;
      } catch {
        update((state) => ({ ...state, hasToken: false, authenticated: false }));
        return false;
      }
    },

    /**
     * Initialize a new token (first-time setup)
     */
    async init(token: string): Promise<boolean> {
      try {
        await api.initToken(token);
        saveToken(token);
        setAuthToken(token);
        update((state) => ({
          ...state,
          token,
          hasToken: true,
          authenticated: true,
        }));
        return true;
      } catch (error) {
        console.error('Failed to init token:', error);
        return false;
      }
    },

    /**
     * Verify token (login)
     */
    async verify(token: string): Promise<boolean> {
      try {
        await api.verifyToken(token);
        saveToken(token);
        setAuthToken(token);
        update((state) => ({
          ...state,
          token,
          authenticated: true,
        }));
        return true;
      } catch (error) {
        console.error('Token verification failed:', error);
        return false;
      }
    },

    /**
     * Update token (requires current token)
     */
    async updateToken(currentToken: string, newToken: string): Promise<boolean> {
      try {
        await api.updateToken(currentToken, newToken);
        saveToken(newToken);
        setAuthToken(newToken);
        update((state) => ({
          ...state,
          token: newToken,
        }));
        return true;
      } catch (error) {
        console.error('Failed to update token:', error);
        return false;
      }
    },

    /**
     * Logout - clear local state
     */
    logout(): void {
      removeToken();
      setAuthToken(null);
      set({
        token: null,
        hasToken: null,
        authenticated: false,
      });
    },

    /**
     * Get current token
     */
    getToken(): string | null {
      return get({ subscribe }).token;
    },

    /**
     * Check if we have a stored token (for auto-login)
     */
    hasStoredToken(): boolean {
      return loadStoredToken() !== null;
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
      return get({ subscribe }).authenticated;
    },
  };
}

export const authStore = createAuthStore();

// Derived helper for checking if auth flow should be shown
export const useAuthCheck = authStore;