import type { AiCommand, Config } from '@clicast/types';
import { randomUUID } from 'crypto';
import {
  loadConfigFromFile,
  saveConfigToFile,
  migrateLegacyTokenFile,
  CONFIG_VERSION,
} from './config-file.js';

const DEFAULT_PORT = 3456;
const DEFAULT_AI_COMMAND = 'claude';
const DEFAULT_AI_COMMAND_NAME = 'Default';

function parseAllowedDirs(value: string | undefined): string[] {
  if (!value || value.trim() === '') {
    return [];
  }
  return value.split(',').map((dir) => dir.trim());
}

/**
 * Create default config from environment variables
 * Called only when config file doesn't exist (first run)
 */
function createDefaultFromEnv(): Config {
  const port = parseInt(process.env.PORT || '', 10) || DEFAULT_PORT;
  const allowedDirs = parseAllowedDirs(process.env.ALLOWED_DIRS);

  // Check if AI_COMMAND env var exists for backward compatibility
  const envAiCommand = process.env.AI_COMMAND;
  let aiCommands: AiCommand[];

  if (envAiCommand) {
    // Use environment variable as the default command
    aiCommands = [
      {
        id: randomUUID(),
        name: DEFAULT_AI_COMMAND_NAME,
        cmd: envAiCommand,
        enabled: true,
      },
    ];
  } else {
    // Default command
    aiCommands = [
      {
        id: randomUUID(),
        name: DEFAULT_AI_COMMAND_NAME,
        cmd: DEFAULT_AI_COMMAND,
        enabled: true,
      },
    ];
  }

  return {
    aiCommands,
    allowedDirs,
    port,
  };
}

/**
 * Get current configuration
 * Loads from file if available, otherwise creates from env or defaults
 */
export function getConfig(): Config {
  // Try to migrate legacy token file first
  migrateLegacyTokenFile();

  const fileConfig = loadConfigFromFile();

  if (fileConfig) {
    // Config file exists - use values from file

    // Ensure aiCommands is not empty - create default if needed
    if (!fileConfig.aiCommands || fileConfig.aiCommands.length === 0) {
      fileConfig.aiCommands = [
        {
          id: randomUUID(),
          name: DEFAULT_AI_COMMAND_NAME,
          cmd: DEFAULT_AI_COMMAND,
          enabled: true,
        },
      ];
      saveConfigToFile(fileConfig);
    }

    return {
      aiCommands: fileConfig.aiCommands,
      allowedDirs: fileConfig.allowedDirs || [],
      port: fileConfig.port || DEFAULT_PORT,
    };
  }

  // First run - create config from environment or defaults
  const defaultConfig = createDefaultFromEnv();

  // Save the default config to file
  saveConfigToFile({
    version: CONFIG_VERSION,
    aiCommands: defaultConfig.aiCommands,
    allowedDirs: defaultConfig.allowedDirs,
    port: defaultConfig.port,
  });

  console.log(`Created default config file at clicast.json`);

  return defaultConfig;
}

/**
 * Get config by reading directly from file (without initialization)
 * Returns null if file doesn't exist
 */
export function getConfigFromFile(): Config | null {
  const fileConfig = loadConfigFromFile();
  if (!fileConfig) {
    return null;
  }

  return {
    aiCommands: fileConfig.aiCommands || [],
    allowedDirs: fileConfig.allowedDirs || [],
    port: fileConfig.port || DEFAULT_PORT,
  };
}

export function getAiCommandById(id: string): AiCommand | undefined {
  const config = getConfig();
  return config.aiCommands.find((cmd) => cmd.id === id);
}

export function getEnabledAiCommands(): AiCommand[] {
  const config = getConfig();
  return config.aiCommands.filter((cmd) => cmd.enabled);
}

export function updateConfig(updates: Partial<Config>): Config {
  const current = getConfig();
  const newConfig = { ...current, ...updates };

  // Save to file
  const fileConfig = loadConfigFromFile() || { version: CONFIG_VERSION };
  saveConfigToFile({
    ...fileConfig,
    version: CONFIG_VERSION,
    aiCommands: newConfig.aiCommands,
    allowedDirs: newConfig.allowedDirs,
    port: newConfig.port,
  });

  return newConfig;
}

export function resetConfig(): Config {
  // Delete config file and let getConfig recreate it
  // This will re-read from environment or defaults
  return getConfig();
}

/**
 * Save the current config to ensure it's persisted
 * Useful after external modifications
 */
export function persistConfig(config: Config): void {
  const fileConfig = loadConfigFromFile() || { version: CONFIG_VERSION };
  saveConfigToFile({
    ...fileConfig,
    version: CONFIG_VERSION,
    aiCommands: config.aiCommands,
    allowedDirs: config.allowedDirs,
    port: config.port,
  });
}