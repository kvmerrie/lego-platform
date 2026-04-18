#!/usr/bin/env node

import {
  logGuard,
  readCommandLines,
  restageFiles,
  runCommand,
  runPrettierCheck,
  runPrettierWrite,
} from './_shared.mjs';

const stagedFiles = readCommandLines('git', [
  'diff',
  '--cached',
  '--name-only',
  '--diff-filter=ACMR',
]);

if (stagedFiles.length === 0) {
  logGuard('No staged file changes detected for pre-commit checks.');
  process.exit(0);
}

logGuard('Auto-formatting staged files with Prettier.');
runPrettierWrite(stagedFiles);
restageFiles(stagedFiles);

logGuard('Running staged whitespace and formatting checks.');
runPrettierCheck(stagedFiles);
runCommand('git', ['diff', '--cached', '--check']);
logGuard('Pre-commit guard checks passed.');
