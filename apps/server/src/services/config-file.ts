import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import type { AiCommand } from '@clicast/types';

export const CONFIG_FILE = join(process.cwd(), 'clicast.json');

export const CONFIG_VERSION = '1.0.0';

export interface ConfigFile {
  version: string;
  port?: number;
  allowedDirs?: string[];
  aiCommands?: AiCommand[];
  auth?: {
    tokenHash: string;
    salt?: string;
  };
}

export interface ConfigFileAuth {
  tokenHash: string;
  salt?: string;
}

/**
 * Hash a token using SHA-256
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Check if config file exists
 */
export function configFileExists(): boolean {
  return existsSync(CONFIG_FILE);
}

/**
 * Load config from file
 * Returns null if file doesn't exist
 */
export function loadConfigFromFile(): ConfigFile | null {
  try {
    if (existsSync(CONFIG_FILE)) {
      const content = readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(content) as ConfigFile;
    }
  } catch (error) {
    console.error('Failed to load config file:', error);
  }
  return null;
}

/**
 * Save config to file
 */
export function saveConfigToFile(config: ConfigFile): void {
  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save config file:', error);
    throw error;
  }
}

/**
 * Ensure config file exists
 * If it doesn't exist, create it with defaults
 */
export function ensureConfigFile(): ConfigFile {
  const existing = loadConfigFromFile();
  if (existing) {
    return existing;
  }

  const defaultConfig: ConfigFile = {
    version: CONFIG_VERSION,
  };
  saveConfigToFile(defaultConfig);
  return defaultConfig;
}

/**
 * Migrate from old .clicast-token file to config.json
 * Returns true if migration was performed
 */
export function migrateLegacyTokenFile(): boolean {
  const legacyTokenFile = join(process.cwd(), '.clicast-token');

  if (existsSync(legacyTokenFile) && !configFileExists()) {
    try {
      const tokenHash = readFileSync(legacyTokenFile, 'utf-8').trim();
      const config: ConfigFile = {
        version: CONFIG_VERSION,
        auth: {
          tokenHash,
        },
      };
      saveConfigToFile(config);
      console.log(`Migrated token from ${legacyTokenFile} to ${CONFIG_FILE}`);
      return true;
    } catch (error) {
      console.error('Failed to migrate legacy token file:', error);
    }
  }
  return false;
}

/**
 * Get the config file path (for displaying to user)
 */
export function getConfigFilePath(): string {
  return CONFIG_FILE;
}