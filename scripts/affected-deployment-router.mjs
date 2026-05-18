#!/usr/bin/env node

import { appendFileSync, readFileSync } from 'node:fs';

export const deployTargets = ['web', 'api'];

const feedJobProjects = new Set([
  'alternate-feed-sync',
  'awin-feed-sync',
  'conrad-feed-sync',
  'coppenswarenhuis-feed-sync',
  'goodbricks-feed-sync',
  'lidl-feed-sync',
  'mediamarkt-feed-sync',
  'misterbricks-feed-sync',
]);

const manualCronJobProjects = new Set([
  ...feedJobProjects,
  'commerce-sync',
  'wishlist-alerts',
]);

const webProjectPatterns = [
  /^web$/,
  /^shell-web$/,
  /^catalog-(feature|ui|data-access-web|data-access$|util$)/,
  /^pricing-(feature|data-access$|util$|ui$)/,
  /^affiliate-(feature|data-access$|util$|ui$)/,
  /^content-(feature|data-access$|util$|ui$)/,
  /^collection-(feature|data-access$|util$|ui$)/,
  /^wishlist-(feature|data-access$|util$|ui$)/,
  /^user-(feature|data-access$|util$|ui$)/,
  /^shared-(ui|design-tokens|config|util|types)$/,
];

const apiProjectPatterns = [
  /^api$/,
  /^api-data-access-server$/,
  /-data-access-server$/,
  /^shared-data-access-auth-server$/,
  /^shared-(config|util|types)$/,
];

const commerceSyncProjectPatterns = [
  /^commerce-sync$/,
  /^api-data-access-server$/,
  /^commerce-(data-access-server|util)$/,
  /^pricing-(data-access-server|util|data-access$)/,
  /^affiliate-(data-access-server|util|data-access$)/,
  /^catalog-(data-access-server|data-access$|util$)/,
  /^shared-(config|util|types)$/,
];

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function parseList(value) {
  if (!value) {
    return [];
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);

    if (!Array.isArray(parsed)) {
      throw new Error('Expected a JSON array.');
    }

    return parsed.map((item) => String(item).trim()).filter(Boolean);
  }

  return trimmed
    .split(/[\s,]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildManualCronWarning(project) {
  if (project === 'commerce-sync') {
    return 'commerce-sync: commerce-sync code changed; redeploy the Render cron job manually';
  }

  if (feedJobProjects.has(project)) {
    return `${project}: feed cron code changed; redeploy the Render cron job manually`;
  }

  return `${project}: cron code changed; redeploy the Render cron job manually`;
}

function isDocsOrTestsOnlyFile(filePath) {
  return (
    filePath.startsWith('docs/') ||
    filePath.endsWith('.md') ||
    filePath.endsWith('.mdx') ||
    filePath.includes('/__tests__/') ||
    filePath.includes('/test/') ||
    filePath.includes('/tests/') ||
    /\.(spec|test)\.[cm]?[jt]sx?$/u.test(filePath) ||
    /(^|\/)(vitest|jest)\.config\.[cm]?[jt]s$/u.test(filePath)
  );
}

export function isDocsOnlyOrTestsOnly(changedFiles) {
  return (
    changedFiles.length > 0 &&
    changedFiles.every((filePath) => isDocsOrTestsOnlyFile(filePath))
  );
}

function projectMatches(project, patterns) {
  return patterns.some((pattern) => pattern.test(project));
}

export function routeAffectedDeployments({
  affectedProjects,
  changedFiles = [],
  detectionUncertain = false,
  manualTargets = [],
} = {}) {
  const normalizedManualTargets = uniqueSorted(
    manualTargets.map((target) => String(target).trim()).filter(Boolean),
  );

  if (normalizedManualTargets.length > 0) {
    const unknownTargets = normalizedManualTargets.filter(
      (target) => !deployTargets.includes(target),
    );

    if (unknownTargets.length > 0) {
      throw new Error(
        `Unsupported manual deploy target(s): ${unknownTargets.join(', ')}. Supported targets: ${deployTargets.join(', ')}.`,
      );
    }

    return {
      affectedProjects: uniqueSorted(affectedProjects ?? []),
      changedFiles,
      detectionUncertain: false,
      manualActions: [],
      manualOverride: true,
      reason: 'manual_override',
      targets: normalizedManualTargets,
    };
  }

  if (detectionUncertain) {
    return {
      affectedProjects: uniqueSorted(affectedProjects ?? []),
      changedFiles,
      detectionUncertain: true,
      manualActions: [],
      manualOverride: false,
      reason: 'uncertain_detection_fallback',
      targets: ['api', 'web'],
    };
  }

  if (isDocsOnlyOrTestsOnly(changedFiles)) {
    return {
      affectedProjects: uniqueSorted(affectedProjects ?? []),
      changedFiles,
      detectionUncertain: false,
      manualActions: [],
      manualOverride: false,
      reason: 'docs_or_tests_only',
      targets: [],
    };
  }

  const projects = uniqueSorted(affectedProjects ?? []);
  const targets = new Set();
  const manualActions = new Set();

  for (const project of projects) {
    if (projectMatches(project, webProjectPatterns)) {
      targets.add('web');
    }

    if (projectMatches(project, apiProjectPatterns)) {
      targets.add('api');
    }

    if (projectMatches(project, commerceSyncProjectPatterns)) {
      manualActions.add(
        'commerce-sync: commerce-sync code changed; redeploy the Render cron job manually',
      );
    }

    if (manualCronJobProjects.has(project)) {
      manualActions.add(buildManualCronWarning(project));
    }
  }

  return {
    affectedProjects: projects,
    changedFiles,
    detectionUncertain: false,
    manualActions: uniqueSorted([...manualActions]),
    manualOverride: false,
    reason: targets.size > 0 ? 'affected_projects' : 'no_deployable_projects',
    targets: uniqueSorted([...targets]),
  };
}

function envNameForTarget(target) {
  return `${target.toUpperCase().replaceAll('-', '_')}_DEPLOY_HOOK_URL`;
}

function writeGithubOutput(result) {
  if (!process.env['GITHUB_OUTPUT']) {
    return;
  }

  const lines = [
    `targets=${result.targets.join(',')}`,
    `targets_json=${JSON.stringify(result.targets)}`,
    `manual_actions=${(result.manualActions ?? []).join(' | ')}`,
    `manual_actions_json=${JSON.stringify(result.manualActions ?? [])}`,
    `manual_override=${String(result.manualOverride)}`,
    `reason=${result.reason}`,
    `detection_uncertain=${String(result.detectionUncertain)}`,
    ...deployTargets.map(
      (target) =>
        `deploy_${target.replaceAll('-', '_')}=${result.targets.includes(target)}`,
    ),
  ];

  appendFileSync(process.env['GITHUB_OUTPUT'], `${lines.join('\n')}\n`);
}

function readFileList(filePath) {
  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function triggerDeployHooks(targets) {
  if (targets.length === 0) {
    console.log('[affected-deploy] no production deployment targets selected');
    return;
  }

  for (const target of targets) {
    const envName = envNameForTarget(target);
    const hookUrl = process.env[envName];

    if (!hookUrl) {
      throw new Error(
        `Missing ${envName} for selected deploy target ${target}.`,
      );
    }

    console.log(
      `[affected-deploy] triggering target=${target} hook_configured=true`,
    );
    const response = await fetch(hookUrl, {
      method: 'POST',
    });

    console.log(
      `[affected-deploy] target=${target} status=${response.status} ok=${response.ok}`,
    );

    if (!response.ok) {
      throw new Error(
        `Deploy hook for ${target} failed with HTTP ${response.status}.`,
      );
    }
  }
}

function readRouteInputsFromArgs(args) {
  const getArgValue = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };

  const affectedProjectsFile = getArgValue('--affected-projects-file');
  const changedFilesFile = getArgValue('--changed-files-file');

  return {
    affectedProjects: affectedProjectsFile
      ? readFileList(affectedProjectsFile)
      : parseList(process.env['AFFECTED_PROJECTS'] ?? ''),
    changedFiles: changedFilesFile
      ? readFileList(changedFilesFile)
      : parseList(process.env['CHANGED_FILES'] ?? ''),
    detectionUncertain:
      process.env['AFFECTED_DETECTION_UNCERTAIN'] === 'true' ||
      args.includes('--uncertain'),
    manualTargets: parseList(
      getArgValue('--manual-targets') ??
        process.env['MANUAL_DEPLOY_TARGETS'] ??
        '',
    ),
  };
}

async function main() {
  const [command = 'route', ...args] = process.argv.slice(2);

  if (command === 'route') {
    const result = routeAffectedDeployments(readRouteInputsFromArgs(args));

    console.log('[affected-deploy] affected projects', result.affectedProjects);
    console.log('[affected-deploy] changed files', result.changedFiles);
    console.log('[affected-deploy] selected targets', {
      manualOverride: result.manualOverride,
      manualActions: result.manualActions,
      reason: result.reason,
      targets: result.targets,
      uncertain: result.detectionUncertain,
    });
    for (const manualAction of result.manualActions ?? []) {
      console.warn(`[affected-deploy] manual action: ${manualAction}`);
    }
    writeGithubOutput(result);
    return;
  }

  if (command === 'deploy') {
    await triggerDeployHooks(parseList(process.env['DEPLOY_TARGETS'] ?? ''));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(
      `[affected-deploy] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
