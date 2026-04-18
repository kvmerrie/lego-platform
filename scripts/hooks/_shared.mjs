import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

export const catalogGuardPrefixes = ['apps/catalog-sync/', 'libs/catalog/'];

export const commerceGuardPrefixes = [
  'apps/commerce-sync/',
  'libs/pricing/',
  'libs/affiliate/',
];

export function logGuard(message) {
  console.log(`[guard] ${message}`);
}

export function failGuard(message, exitCode = 1) {
  console.error(`[guard] ${message}`);
  process.exit(exitCode);
}

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    input: options.input,
    stdio: options.captureOutput ? ['pipe', 'pipe', 'pipe'] : 'inherit',
  });

  if (options.allowFailure) {
    return result;
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }

  return result;
}

export function readCommandLines(command, args, options = {}) {
  const result = runCommand(command, args, {
    ...options,
    allowFailure: true,
    captureOutput: true,
  });

  if (result.status !== 0 && !options.allowFailure) {
    const stderr = result.stderr?.trim();

    if (stderr) {
      console.error(stderr);
    }
    process.exit(result.status ?? 1);
  }

  if (result.status !== 0) {
    return [];
  }

  return (result.stdout ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function chunkItems(items, chunkSize = 40) {
  const chunks = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

export function getExistingRepoFiles(files) {
  return files.filter((file) => existsSync(path.resolve(process.cwd(), file)));
}

export function runPrettierCheck(files) {
  const existingFiles = getExistingRepoFiles(files);

  for (const fileChunk of chunkItems(existingFiles)) {
    runCommand(pnpmCommand, [
      'exec',
      'prettier',
      '--check',
      '--ignore-unknown',
      ...fileChunk,
    ]);
  }
}

export function runPrettierWrite(files) {
  const existingFiles = getExistingRepoFiles(files);

  for (const fileChunk of chunkItems(existingFiles)) {
    runCommand(pnpmCommand, [
      'exec',
      'prettier',
      '--write',
      '--ignore-unknown',
      ...fileChunk,
    ]);
  }
}

export function restageFiles(files) {
  const existingFiles = getExistingRepoFiles(files);

  for (const fileChunk of chunkItems(existingFiles)) {
    runCommand('git', ['add', '--', ...fileChunk]);
  }
}

export function hasPrefixMatch(files, prefixes) {
  return files.some((file) =>
    prefixes.some((prefix) => file.startsWith(prefix)),
  );
}

export function isZeroSha(value) {
  return /^0+$/.test(value);
}
