import { readdirSync, statSync, lstatSync } from 'fs';
import { join, relative, basename, dirname } from 'path';
import type { FileEntry, Breadcrumb, DirResponse } from '@online-cc/types';

export function listDir(path: string): DirResponse {
  try {
    const entries = readdirSync(path, { withFileTypes: true });

    const fileEntries: FileEntry[] = entries.map((entry) => {
      const fullPath = join(path, entry.name);
      let type: 'file' | 'directory' = 'file';
      let size: number | undefined;
      let modified: number | undefined;

      try {
        if (entry.isSymbolicLink()) {
          const target = lstatSync(fullPath);
          if (target.isDirectory()) {
            type = 'directory';
          }
          modified = target.mtimeMs;
        } else if (entry.isDirectory()) {
          type = 'directory';
          modified = statSync(fullPath).mtimeMs;
        } else {
          const stats = statSync(fullPath);
          type = 'file';
          size = stats.size;
          modified = stats.mtimeMs;
        }
      } catch {
        // If we can't stat the file, just show it as a file
      }

      return {
        name: entry.name,
        path: fullPath,
        type,
        size,
        modified,
      };
    });

    // Sort: directories first, then files, both alphabetically
    fileEntries.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      path,
      entries: fileEntries,
    };
  } catch (error) {
    throw new Error(`Cannot read directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function getBreadcrumbs(path: string): Breadcrumb[] {
  const breadcrumbs: Breadcrumb[] = [];
  let currentPath = '';

  const parts = path.split('/').filter(Boolean);

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
    breadcrumbs.push({
      name: part,
      path: currentPath,
    });
  }

  return breadcrumbs;
}

export function validatePath(path: string, allowedDirs: string[]): boolean {
  if (allowedDirs.length === 0) {
    return true;
  }

  return allowedDirs.some((allowed) => {
    return path === allowed || path.startsWith(`${allowed}/`);
  });
}

export function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || '/';
}

export function getRootDirs(): string[] {
  if (process.platform === 'darwin') {
    return ['/Users', '/Volumes', '/Applications'];
  }
  if (process.platform === 'win32') {
    return ['C:\\', 'D:\\'];
  }
  return ['/'];
}