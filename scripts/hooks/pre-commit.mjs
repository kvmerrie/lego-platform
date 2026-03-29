#!/usr/bin/env node

import {
  logGuard,
  readCommandLines,
  runCommand,
  runPrettierCheck,
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

logGuard('Running staged whitespace and formatting checks.');
runCommand('git', ['diff', '--cached', '--check']);
runPrettierCheck(stagedFiles);
logGuard('Pre-commit guard checks passed.');
