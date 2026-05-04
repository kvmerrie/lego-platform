#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const cssFilePattern = /\.(?:css|scss)$/u;
const ignoredPathParts = new Set([
  '.next',
  'coverage',
  'dist',
  'node_modules',
  'storybook-static',
]);
const sourceRoots = ['apps', 'libs'];
const designTokenFile =
  'libs/shared/design-tokens/src/lib/shared-design-tokens.ts';

function isIgnoredPath(filePath) {
  return filePath.split('/').some((pathPart) => ignoredPathParts.has(pathPart));
}

function listTrackedSourceCssFiles() {
  try {
    return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .filter((filePath) => cssFilePattern.test(filePath))
      .filter((filePath) => !isIgnoredPath(filePath));
  } catch {
    return [];
  }
}

function listSourceCssFilesFromDisk() {
  const files = [];

  function visit(directoryPath) {
    if (!existsSync(directoryPath) || isIgnoredPath(directoryPath)) {
      return;
    }

    for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
      const entryPath = join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (cssFilePattern.test(entry.name)) {
        files.push(entryPath);
      }
    }
  }

  for (const sourceRoot of sourceRoots) {
    visit(sourceRoot);
  }

  return files;
}

function listSourceCssFiles() {
  const trackedFiles = listTrackedSourceCssFiles();
  const diskFiles = listSourceCssFilesFromDisk();

  return [...new Set([...trackedFiles, ...diskFiles])].sort();
}

function getLineNumber(sourceText, index) {
  return sourceText.slice(0, index).split('\n').length;
}

function collectCentralDesignTokens() {
  const sourceText = readFileSync(designTokenFile, 'utf8');
  const tokens = new Set();

  for (const match of sourceText.matchAll(/['"]([a-zA-Z0-9_-]+)['"]\s*:/gu)) {
    tokens.add(`--${match[1]}`);
  }

  return tokens;
}

function collectCssCustomPropertyDefinitions(cssFiles) {
  const definitions = new Set();

  for (const filePath of cssFiles) {
    const sourceText = readFileSync(filePath, 'utf8');

    for (const match of sourceText.matchAll(
      /(^|[^\w-])(--[a-zA-Z0-9_-]+)\s*:/gmu,
    )) {
      definitions.add(match[2]);
    }
  }

  return definitions;
}

function collectCssCustomPropertyReferences(cssFiles) {
  const references = [];

  for (const filePath of cssFiles) {
    const sourceText = readFileSync(filePath, 'utf8');

    for (const match of sourceText.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/gu)) {
      references.push({
        column:
          match.index -
          sourceText.lastIndexOf('\n', Math.max(0, match.index - 1)),
        filePath,
        line: getLineNumber(sourceText, match.index),
        token: match[1],
      });
    }
  }

  return references;
}

const cssFiles = listSourceCssFiles();
const definedTokens = new Set([
  ...collectCentralDesignTokens(),
  ...collectCssCustomPropertyDefinitions(cssFiles),
]);
const undefinedReferences = collectCssCustomPropertyReferences(cssFiles).filter(
  (reference) => !definedTokens.has(reference.token),
);

if (undefinedReferences.length) {
  console.error('Undefined CSS custom properties found:');

  for (const reference of undefinedReferences) {
    console.error(
      `- ${reference.token} at ${reference.filePath}:${reference.line}:${reference.column}`,
    );
  }

  process.exit(1);
}

console.log(
  `[css-custom-property-audit] ok files=${cssFiles.length} defined=${definedTokens.size}`,
);
