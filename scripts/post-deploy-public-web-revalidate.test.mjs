import { describe, expect, test, vi } from 'vitest';

import {
  isProductionDeployment,
  isPublicWebDeploymentTarget,
  resolvePostDeployRevalidationConfig,
  runPostDeployPublicWebRevalidation,
} from './post-deploy-public-web-revalidate.mjs';

describe('post-deploy public web revalidation', () => {
  test('detects explicit production deployments', () => {
    expect(
      isProductionDeployment({ DEPLOYMENT_ENVIRONMENT: 'Production' }),
    ).toBe(true);
    expect(isProductionDeployment({ VERCEL_ENV: 'preview' })).toBe(false);
  });

  test('recognizes public web deployment targets', () => {
    expect(
      isPublicWebDeploymentTarget({
        deploymentTargetUrl: 'https://brickhunt-git-main.vercel.app',
        webBaseUrl: 'https://www.brickhunt.nl',
      }),
    ).toBe(true);
    expect(
      isPublicWebDeploymentTarget({
        deploymentTargetUrl: 'https://www.brickhunt.nl',
        webBaseUrl: 'https://www.brickhunt.nl',
      }),
    ).toBe(true);
    expect(
      isPublicWebDeploymentTarget({
        deploymentTargetUrl: 'https://brickhunt-api.onrender.com',
        webBaseUrl: 'https://www.brickhunt.nl',
      }),
    ).toBe(false);
  });

  test('reports missing production envs', () => {
    expect(
      resolvePostDeployRevalidationConfig({
        DEPLOYMENT_ENVIRONMENT: 'production',
      }),
    ).toMatchObject({
      missingEnvNames: ['WEB_BASE_URL', 'WEB_REVALIDATE_SECRET'],
      productionDeployment: true,
    });
  });

  test('skips preview deployments without revalidating', async () => {
    const fetchImpl = vi.fn();

    await expect(
      runPostDeployPublicWebRevalidation({
        environment: {
          DEPLOYMENT_ENVIRONMENT: 'preview',
          WEB_BASE_URL: 'https://www.brickhunt.nl',
          WEB_REVALIDATE_SECRET: 'secret',
        },
        fetchImpl,
      }),
    ).resolves.toMatchObject({ attempted: false, skipped: true });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('skips non-web production deployments without revalidating', async () => {
    const fetchImpl = vi.fn();

    await expect(
      runPostDeployPublicWebRevalidation({
        environment: {
          DEPLOYMENT_ENVIRONMENT: 'production',
          DEPLOYMENT_TARGET_URL: 'https://brickhunt-api.onrender.com',
          WEB_BASE_URL: 'https://www.brickhunt.nl',
          WEB_REVALIDATE_SECRET: 'secret',
        },
        fetchImpl,
      }),
    ).resolves.toMatchObject({ attempted: false, skipped: true });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('posts production deploy revalidation payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    await expect(
      runPostDeployPublicWebRevalidation({
        environment: {
          DEPLOYMENT_ENVIRONMENT: 'production',
          WEB_BASE_URL: 'https://www.brickhunt.nl',
          WEB_REVALIDATE_SECRET: 'secret',
        },
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      attempted: true,
      pathCount: 3,
      skipped: false,
      status: 200,
      tagCount: 3,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://www.brickhunt.nl/api/revalidate',
      expect.objectContaining({
        body: JSON.stringify({
          paths: ['/', '/deals', '/themes'],
          reason: 'production_deploy',
          tags: ['homepage', 'deals', 'themes'],
        }),
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': 'secret',
        },
        method: 'POST',
      }),
    );
  });

  test('fails visibly on production http failures', async () => {
    await expect(
      runPostDeployPublicWebRevalidation({
        environment: {
          DEPLOYMENT_ENVIRONMENT: 'production',
          WEB_BASE_URL: 'https://www.brickhunt.nl',
          WEB_REVALIDATE_SECRET: 'secret',
        },
        fetchImpl: vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          text: () => Promise.resolve('unauthorized'),
        }),
      }),
    ).rejects.toThrow(
      'Production post-deploy public web revalidation failed with status 401.',
    );
  });
});
