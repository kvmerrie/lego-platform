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

test('routes API server libraries to api and commerce-sync when shared by both', () => {
  const result = routeAffectedDeployments({
    affectedProjects: ['api-data-access-server'],
    changedFiles: [
      'libs/api/data-access-server/src/lib/commerce-sync-server.ts',
    ],
  });

  assert.deepEqual(result.targets, ['api', 'commerce-sync']);
});

test('routes feed apps to their individual feed job only', () => {
  const result = routeAffectedDeployments({
    affectedProjects: ['goodbricks-feed-sync'],
    changedFiles: ['apps/goodbricks-feed-sync/src/main.ts'],
  });

  assert.deepEqual(result.targets, ['goodbricks-feed-sync']);
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
    manualTargets: ['commerce-sync', 'web'],
  });

  assert.deepEqual(result.targets, ['commerce-sync', 'web']);
  assert.equal(result.reason, 'manual_override');
});
