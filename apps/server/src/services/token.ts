import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import {
  loadConfigFromFile,
  saveConfigToFile,
  hashToken,
  configFileExists,
  CONFIG_FILE,
  CONFIG_VERSION,
} from './config-file.js';

// Legacy token file path for migration
const LEGACY_TOKEN_FILE = join(process.cwd(), '.clicast-token');

/**
 * Check if token file (either config or legacy) exists
 */
export function tokenFileExists(): boolean {
  // Check new config file first
  if (configFileExists()) {
    const config = loadConfigFromFile();
    if (config?.auth?.tokenHash) {
      return true;
    }
  }
  // Check legacy file
  return existsSync(LEGACY_TOKEN_FILE);
}

/**
 * Get stored token hash from config file
 * Also handles migration from legacy token file
 */
export function getStoredTokenHash(): string | null {
  // Try to migrate legacy token file first
  migrateLegacyTokenFile();

  // Load from config file
  const config = loadConfigFromFile();
  if (config?.auth?.tokenHash) {
    return config.auth.tokenHash;
  }

  // Fallback: check legacy file (for systems not yet migrated)
  try {
    if (existsSync(LEGACY_TOKEN_FILE)) {
      return readFileSync(LEGACY_TOKEN_FILE, 'utf-8').trim();
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Create or update the token in config file
 * Returns true if successful, false if token already exists (use updateToken instead)
 */
export function createToken(token: string): boolean {
  const existingHash = getStoredTokenHash();
  if (existingHash !== null) {
    return false; // Token already exists
  }

  const hash = hashToken(token);

  const config = loadConfigFromFile() || { version: CONFIG_VERSION };
  saveConfigToFile({
    ...config,
    version: CONFIG_VERSION,
    auth: {
      tokenHash: hash,
    },
  });

  console.log(`Token created in ${CONFIG_FILE}`);
  return true;
}

/**
 * Verify a token against the stored hash
 */
export function verifyToken(token: string): boolean {
  const storedHash = getStoredTokenHash();
  if (!storedHash) {
    return false; // No token exists
  }

  const inputHash = hashToken(token);
  return storedHash === inputHash;
}

/**
 * Update an existing token (requires current token to match)
 * Returns true if successful
 */
export function updateToken(currentToken: string, newToken: string): boolean {
  const storedHash = getStoredTokenHash();
  if (!storedHash) {
    return false;
  }

  const currentHash = hashToken(currentToken);
  if (currentHash !== storedHash) {
    return false; // Current token doesn't match
  }

  const newHash = hashToken(newToken);

  const config = loadConfigFromFile() || { version: CONFIG_VERSION };
  saveConfigToFile({
    ...config,
    version: CONFIG_VERSION,
    auth: {
      tokenHash: newHash,
    },
  });

  console.log(`Token updated in ${CONFIG_FILE}`);
  return true;
}

/**
 * Delete the token from config file and legacy file
 * Returns true if deleted, false if didn't exist
 */
export function deleteToken(): boolean {
  let deleted = false;

  // Delete from config file
  try {
    const config = loadConfigFromFile();
    if (config) {
      if (config.auth) {
        delete config.auth;
        saveConfigToFile(config);
        console.log(`Token deleted from ${CONFIG_FILE}`);
        deleted = true;
      }
    }
  } catch (error) {
    console.error(`Failed to delete token from config: ${error}`);
  }

  // Also delete legacy file if it exists
  try {
    if (existsSync(LEGACY_TOKEN_FILE)) {
      unlinkSync(LEGACY_TOKEN_FILE);
      console.log(`Legacy token file deleted from ${LEGACY_TOKEN_FILE}`);
      deleted = true;
    }
  } catch (error) {
    console.error(`Failed to delete legacy token file: ${error}`);
  }

  return deleted;
}

/**
 * Get the config file path (for displaying to user)
 */
export function getTokenFilePath(): string {
  return CONFIG_FILE;
}

/**
 * Migrate from old .clicast-token file to config.json
 * Called internally by getStoredTokenHash
 */
function migrateLegacyTokenFile(): boolean {
  if (existsSync(LEGACY_TOKEN_FILE) && !configFileExists()) {
    try {
      const tokenHash = readFileSync(LEGACY_TOKEN_FILE, 'utf-8').trim();
      const config: typeof loadConfigFromFile extends () => infer T ? T : never = {
        version: CONFIG_VERSION,
        auth: {
          tokenHash,
        },
      };
      saveConfigToFile(config);
      console.log(`Migrated token from ${LEGACY_TOKEN_FILE} to ${CONFIG_FILE}`);
      return true;
    } catch (error) {
      console.error('Failed to migrate legacy token file:', error);
    }
  }
  return false;
}