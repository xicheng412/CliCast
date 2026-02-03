import type { Config } from '@online-cc/types';

const DEFAULT_PORT = 3000;
const DEFAULT_CLAUDE_COMMAND = 'claude';

let cachedConfig: Config | null = null;

function parseAllowedDirs(value: string | undefined): string[] {
  if (!value || value.trim() === '') {
    return [];
  }
  return value.split(',').map((dir) => dir.trim());
}

export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const port = parseInt(process.env.PORT || '', 10) || DEFAULT_PORT;
  const claudeCommand = process.env.CLAUDE_COMMAND || DEFAULT_CLAUDE_COMMAND;
  const allowedDirs = parseAllowedDirs(process.env.ALLOWED_DIRS);

  cachedConfig = {
    claudeCommand,
    allowedDirs,
    port,
  };

  return cachedConfig;
}

export function updateConfig(updates: Partial<Config>): Config {
  const current = getConfig();
  cachedConfig = { ...current, ...updates };

  // Note: Environment variables cannot be updated at runtime
  // If you need runtime configuration changes, consider using a different approach
  return cachedConfig;
}

export function resetConfig(): Config {
  cachedConfig = null;
  return getConfig();
}