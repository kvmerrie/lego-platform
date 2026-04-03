#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import {
  catalogGuardPrefixes,
  commerceGuardPrefixes,
  failGuard,
  hasPrefixMatch,
  isZeroSha,
  logGuard,
  pnpmCommand,
  readCommandLines,
  runCommand,
  runPrettierCheck,
} from './_shared.mjs';

function readPushChangedFiles(pushStdinText) {
  const pushUpdates = pushStdinText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const changedFiles = new Set();

  for (const pushUpdate of pushUpdates) {
    const [localRef, localSha, , remoteSha] = pushUpdate.split(/\s+/);

    if (!localRef || !localSha || isZeroSha(localSha)) {
      continue;
    }

    const rangeFiles = isZeroSha(remoteSha)
      ? readCommandLines(
          'git',
          [
            'rev-list',
            '--name-only',
            '--no-commit-header',
            localSha,
            '--not',
            '--remotes',
          ],
          { allowFailure: true },
        )
      : readCommandLines(
          'git',
          ['diff', '--name-only', `${remoteSha}..${localSha}`],
          {
            allowFailure: true,
          },
        );

    const fallbackFiles =
      rangeFiles.length > 0
        ? rangeFiles
        : readCommandLines(
            'git',
            ['diff-tree', '--no-commit-id', '--name-only', '-r', localSha],
            {
              allowFailure: true,
            },
          );

    for (const changedFile of fallbackFiles) {
      changedFiles.add(changedFile);
    }
  }

  if (changedFiles.size > 0) {
    return [...changedFiles];
  }

  const pushRangeFiles = readCommandLines(
    'git',
    ['diff', '--name-only', '@{push}..HEAD'],
    { allowFailure: true },
  );

  if (pushRangeFiles.length > 0) {
    return pushRangeFiles;
  }

  return readCommandLines(
    'git',
    ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'],
    { allowFailure: true },
  );
}

function readDirtyGeneratedArtifacts() {
  return readCommandLines('git', ['status', '--porcelain']).filter((line) =>
    line.includes('.generated.'),
  );
}

const pushStdinText = readFileSync(0, 'utf8');
const changedFiles = readPushChangedFiles(pushStdinText);

if (changedFiles.length > 0) {
  logGuard(
    `Running changed-file formatting checks for ${changedFiles.length} file(s).`,
  );
  runPrettierCheck(changedFiles);
} else {
  logGuard(
    'No changed files resolved for the push range. Skipping changed-file format check.',
  );
}

const dirtyGeneratedArtifacts = readDirtyGeneratedArtifacts();

if (dirtyGeneratedArtifacts.length > 0) {
  failGuard(
    `Generated artifacts are still modified in the working tree:\n${dirtyGeneratedArtifacts.join(
      '\n',
    )}\nStage and commit those generated updates or revert them before pushing.`,
  );
}

if (hasPrefixMatch(changedFiles, commerceGuardPrefixes)) {
  logGuard(
    'Commerce-related changes detected. Running pnpm sync:commerce:local:check.',
  );
  runCommand(pnpmCommand, ['sync:commerce:local:check']);
}

if (hasPrefixMatch(changedFiles, catalogGuardPrefixes)) {
  logGuard(
    'Catalog-related changes detected. Running pnpm sync:catalog:local:check.',
  );
  runCommand(pnpmCommand, ['sync:catalog:local:check']);
}

logGuard('Pre-push guard checks passed.');
