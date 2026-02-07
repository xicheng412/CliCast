import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

// Token file location: project directory .clicast-token (or custom via TOKEN_FILE env)
const TOKEN_FILE = process.env.TOKEN_FILE || join(process.cwd(), '.clicast-token');

/**
 * Hash a token using SHA-256
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Check if token file exists
 */
export function tokenFileExists(): boolean {
  return existsSync(TOKEN_FILE);
}

/**
 * Get stored token hash (if exists)
 */
export function getStoredTokenHash(): string | null {
  try {
    if (existsSync(TOKEN_FILE)) {
      return readFileSync(TOKEN_FILE, 'utf-8').trim();
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Create or update the token
 * Returns true if successful, false if token already exists (use updateToken instead)
 */
export function createToken(token: string): boolean {
  const existingHash = getStoredTokenHash();
  if (existingHash !== null) {
    return false; // Token already exists
  }

  const hash = hashToken(token);
  writeFileSync(TOKEN_FILE, hash, 'utf-8');
  console.log(`Token created at ${TOKEN_FILE}`);
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
  writeFileSync(TOKEN_FILE, newHash, 'utf-8');
  console.log(`Token updated at ${TOKEN_FILE}`);
  return true;
}

/**
 * Delete the token file
 * Returns true if deleted, false if didn't exist
 */
export function deleteToken(): boolean {
  try {
    if (existsSync(TOKEN_FILE)) {
      unlinkSync(TOKEN_FILE);
      console.log(`Token deleted from ${TOKEN_FILE}`);
      return true;
    }
  } catch (error) {
    console.error(`Failed to delete token: ${error}`);
  }
  return false;
}

/**
 * Get the token file path (for displaying to user)
 */
export function getTokenFilePath(): string {
  return TOKEN_FILE;
}