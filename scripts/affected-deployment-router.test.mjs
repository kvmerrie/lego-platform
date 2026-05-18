import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDocsOnlyOrTestsOnly,
  routeAffectedDeployments,
} from './affected-deployment-router.mjs';

test('routes web-facing changes to the web deployment', () => {
  const result = routeAffectedDeployments({
    affectedProjects: ['catalog-ui', 'web'],
    changedFiles: ['libs/catalog/ui/src/lib/catalog-ui.tsx'],
  });

  assert.deepEqual(result.targets, ['web']);
  assert.equal(result.reason, 'affected_projects');
});

test('routes API server libraries to api and emits commerce-sync manual warning when shared by both', () => {
  const result = routeAffectedDeployments({
    affectedProjects: ['api-data-access-server'],
    changedFiles: [
      'libs/api/data-access-server/src/lib/commerce-sync-server.ts',
    ],
  });

  assert.deepEqual(result.targets, ['api']);
  assert.deepEqual(result.manualActions, [
    'commerce-sync: commerce-sync code changed; redeploy the Render cron job manually',
  ]);
});

test('does not auto deploy feed apps and emits a manual cron warning', () => {
  const result = routeAffectedDeployments({
    affectedProjects: ['goodbricks-feed-sync'],
    changedFiles: ['apps/goodbricks-feed-sync/src/main.ts'],
  });

  assert.deepEqual(result.targets, []);
  assert.deepEqual(result.manualActions, [
    'goodbricks-feed-sync: feed cron code changed; redeploy the Render cron job manually',
  ]);
  assert.equal(result.reason, 'no_deployable_projects');
});

test('does not auto deploy Conrad feed app and emits a manual cron warning', () => {
  const result = routeAffectedDeployments({
    affectedProjects: ['conrad-feed-sync'],
    changedFiles: ['apps/conrad-feed-sync/src/main.ts'],
  });

  assert.deepEqual(result.targets, []);
  assert.deepEqual(result.manualActions, [
    'conrad-feed-sync: feed cron code changed; redeploy the Render cron job manually',
  ]);
  assert.equal(result.reason, 'no_deployable_projects');
});

test('does not auto deploy commerce-sync and emits a manual cron warning', () => {
  const result = routeAffectedDeployments({
    affectedProjects: ['commerce-sync'],
    changedFiles: ['apps/commerce-sync/src/main.ts'],
  });

  assert.deepEqual(result.targets, []);
  assert.deepEqual(result.manualActions, [
    'commerce-sync: commerce-sync code changed; redeploy the Render cron job manually',
  ]);
  assert.equal(result.reason, 'no_deployable_projects');
});

test('does not deploy for docs-only changes', () => {
  const result = routeAffectedDeployments({
    affectedProjects: [],
    changedFiles: ['docs/operations/deployments.md', 'README.md'],
  });

  assert.deepEqual(result.targets, []);
  assert.equal(result.reason, 'docs_or_tests_only');
});

test('does not deploy for tests-only changes', () => {
  assert.equal(
    isDocsOnlyOrTestsOnly([
      'libs/catalog/ui/src/lib/catalog-ui.spec.tsx',
      'apps/api/src/test/admin-promote.spec.ts',
    ]),
    true,
  );
});

test('falls back safely to api and web when detection is uncertain', () => {
  const result = routeAffectedDeployments({
    affectedProjects: [],
    changedFiles: ['libs/shared/config/src/lib/config.ts'],
    detectionUncertain: true,
  });

  assert.deepEqual(result.targets, ['api', 'web']);
  assert.equal(result.reason, 'uncertain_detection_fallback');
});

test('manual targets override affected routing', () => {
  const result = routeAffectedDeployments({
    affectedProjects: ['docs'],
    changedFiles: ['docs/operations/deployments.md'],
    manualTargets: ['api', 'web'],
  });

  assert.deepEqual(result.targets, ['api', 'web']);
  assert.equal(result.manualOverride, true);
  assert.equal(result.reason, 'manual_override');
});

test('manual web target overrides empty affected routing', () => {
  const result = routeAffectedDeployments({
    affectedProjects: [],
    changedFiles: [],
    manualTargets: [' web '],
  });

  assert.deepEqual(result.targets, ['web']);
  assert.equal(result.manualOverride, true);
  assert.equal(result.reason, 'manual_override');
});

test('manual web and api targets de-dupe and override affected routing', () => {
  const result = routeAffectedDeployments({
    affectedProjects: ['goodbricks-feed-sync'],
    changedFiles: ['apps/goodbricks-feed-sync/src/main.ts'],
    manualTargets: ['web', 'api', 'web'],
  });

  assert.deepEqual(result.targets, ['api', 'web']);
  assert.deepEqual(result.manualActions, []);
  assert.equal(result.manualOverride, true);
  assert.equal(result.reason, 'manual_override');
});

test('no manual target uses affected routing', () => {
  const result = routeAffectedDeployments({
    affectedProjects: ['web'],
    changedFiles: ['apps/web/src/app/page.tsx'],
    manualTargets: [],
  });

  assert.deepEqual(result.targets, ['web']);
  assert.equal(result.manualOverride, false);
  assert.equal(result.reason, 'affected_projects');
});

test('manual override rejects unsupported feed targets clearly', () => {
  assert.throws(
    () =>
      routeAffectedDeployments({
        affectedProjects: ['goodbricks-feed-sync'],
        changedFiles: ['apps/goodbricks-feed-sync/src/main.ts'],
        manualTargets: ['goodbricks-feed-sync'],
      }),
    /Unsupported manual deploy target\(s\): goodbricks-feed-sync\. Supported targets: web, api\./u,
  );
});

test('manual override rejects commerce-sync clearly', () => {
  assert.throws(
    () =>
      routeAffectedDeployments({
        affectedProjects: ['commerce-sync'],
        changedFiles: ['apps/commerce-sync/src/main.ts'],
        manualTargets: ['commerce-sync'],
      }),
    /Unsupported manual deploy target\(s\): commerce-sync\. Supported targets: web, api\./u,
  );
});
