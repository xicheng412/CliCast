import { mkdir, cp, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..', '..', '..');
const distDir = join(__dirname, '..', 'dist');
const cliDir = join(__dirname, '..');

async function runCommand(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}`));
    });
    child.on('error', reject);
  });
}

async function buildFrontend() {
  console.log('Building frontend...');
  await runCommand('bun', ['run', 'build'], join(rootDir, 'apps', 'web'));
}

async function buildBackend() {
  console.log('Building backend...');
  await runCommand('bun', ['build', 'src/index.ts', '--outdir', 'dist', '--target', 'bun'],
    join(rootDir, 'apps', 'server'));
}

async function prepareDist() {
  console.log('Preparing dist directory...');

  // Remove existing dist directory
  await rm(distDir, { recursive: true, force: true });

  // Create dist directory
  await mkdir(distDir, { recursive: true });
  await mkdir(join(distDir, 'web'), { recursive: true });
}

async function copyFiles() {
  console.log('Copying files...');

  // Copy built frontend from apps/web/dist to dist/web
  const webDistSrc = join(rootDir, 'apps', 'web', 'dist');
  const webDistDest = join(distDir, 'web');

  // Copy frontend assets
  await cp(webDistSrc, webDistDest, { recursive: true });

  // Copy built server from apps/server/dist to dist/
  const serverDistSrc = join(rootDir, 'apps', 'server', 'dist');
  const serverDistDest = distDir;

  // Copy server assets
  await cp(serverDistSrc, serverDistDest, { recursive: true });

  // Copy package.json
  await cp(join(cliDir, 'package.json'), join(distDir, 'package.json'));

  console.log('Build complete!');
}

async function main() {
  console.log('Starting CliCast build...');

  await prepareDist();
  await buildFrontend();
  await buildBackend();
  await copyFiles();

  console.log(`Build output: ${distDir}`);
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});