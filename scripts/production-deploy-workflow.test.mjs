import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(
  new URL(
    '../.github/workflows/affected-production-deploy.yml',
    import.meta.url,
  ),
  'utf8',
);

test('production deploy router waits for successful CI workflow_run on main', () => {
  assert.match(workflow, /\n\s+workflow_run:\n/u);
  assert.match(workflow, /\n\s+workflows:\n\s+- CI\n/u);
  assert.match(workflow, /\n\s+types:\n\s+- completed\n/u);
  assert.doesNotMatch(workflow, /\n\s+push:\n/u);
  assert.match(
    workflow,
    /github\.event\.workflow_run\.conclusion == 'success'/u,
  );
  assert.match(workflow, /github\.event\.workflow_run\.head_branch == 'main'/u);
});

test('production deploy router keeps manual dispatch and target override support', () => {
  assert.match(workflow, /\n\s+workflow_dispatch:\n/u);
  assert.match(workflow, /deploy_targets:/u);
  assert.match(workflow, /github\.event\.inputs\.deploy_targets/u);
  assert.match(workflow, /manual_override=\$\{manual_override\}/u);
  assert.match(workflow, /--manual-targets "\$\{MANUAL_TARGETS\}"/u);
});

test('workflow_run affected range uses the completed CI head sha', () => {
  assert.match(
    workflow,
    /WORKFLOW_RUN_HEAD_SHA: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/u,
  );
  assert.match(workflow, /HEAD_REF="\$\{WORKFLOW_RUN_HEAD_SHA\}"/u);
  assert.match(workflow, /BASE_REF="\$\(git rev-parse "\$\{HEAD_REF\}~1"\)"/u);
});
