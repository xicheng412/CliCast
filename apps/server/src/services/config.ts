import type { Config } from '@clicast/types';

const DEFAULT_PORT = 3000;
const DEFAULT_AI_COMMAND = 'claude';

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
  const aiCommand = process.env.AI_COMMAND || DEFAULT_AI_COMMAND;
  const allowedDirs = parseAllowedDirs(process.env.ALLOWED_DIRS);

  cachedConfig = {
    aiCommand,
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