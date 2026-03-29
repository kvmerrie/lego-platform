#!/usr/bin/env node

import { existsSync } from 'node:fs';
import path from 'node:path';
import { failGuard, logGuard, pnpmCommand, runCommand } from './_shared.mjs';

const gitDirectoryPath = path.resolve(process.cwd(), '.git');

if (!existsSync(gitDirectoryPath)) {
  logGuard('Skipping Husky install because .git is not available.');
  process.exit(0);
}

const huskyInstallResult = runCommand(pnpmCommand, ['exec', 'husky'], {
  allowFailure: true,
  captureOutput: true,
});

if (huskyInstallResult.stdout?.trim()) {
  process.stdout.write(huskyInstallResult.stdout);
}

const stderr = huskyInstallResult.stderr?.trim();
const stdout = huskyInstallResult.stdout?.trim();

if (stdout) {
  process.stdout.write(`${stdout}\n`);
}

if (stderr) {
  process.stderr.write(`${stderr}\n`);
}

const combinedOutput = `${stdout ?? ''}\n${stderr ?? ''}`;

if (combinedOutput.includes('could not lock config file')) {
  logGuard(
    'Skipping Husky install because git hook configuration is not writable in this environment.',
  );
  process.exit(0);
}

if (combinedOutput.includes('not a git repository')) {
  logGuard(
    'Skipping Husky install because this environment is not a writable git checkout.',
  );
  process.exit(0);
}

if (huskyInstallResult.status !== 0) {
  failGuard('Husky hook installation failed.');
}

logGuard('Husky hooks installed.');
