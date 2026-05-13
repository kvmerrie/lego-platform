const productionEnvironmentNames = new Set(['production', 'prod']);
const revalidationPaths = ['/', '/deals', '/themes'];
const revalidationTags = ['homepage', 'deals', 'themes'];
const revalidationReason = 'production_deploy';
const responseBodyExcerptLimit = 500;

export function normalizeDeploymentEnvironment(environment) {
  return (
    environment.BRICKHUNT_DEPLOY_ENV ??
    environment.VERCEL_ENV ??
    environment.DEPLOYMENT_ENVIRONMENT ??
    environment.GITHUB_DEPLOYMENT_ENVIRONMENT ??
    ''
  )
    .trim()
    .toLowerCase();
}

export function isProductionDeployment(environment) {
  return productionEnvironmentNames.has(
    normalizeDeploymentEnvironment(environment),
  );
}

export function resolvePostDeployRevalidationConfig(environment) {
  const deploymentEnvironment = normalizeDeploymentEnvironment(environment);
  const productionDeployment = productionEnvironmentNames.has(
    deploymentEnvironment,
  );
  const webBaseUrl = environment.WEB_BASE_URL?.trim() ?? '';
  const deploymentTargetUrl =
    environment.DEPLOYMENT_TARGET_URL?.trim() ??
    environment.VERCEL_URL?.trim() ??
    '';
  const secret = environment.WEB_REVALIDATE_SECRET?.trim() ?? '';
  const missingEnvNames = [
    webBaseUrl ? undefined : 'WEB_BASE_URL',
    secret ? undefined : 'WEB_REVALIDATE_SECRET',
  ].filter(Boolean);

  return {
    deploymentTargetUrl,
    deploymentEnvironment,
    missingEnvNames,
    productionDeployment,
    secret,
    webBaseUrl,
  };
}

function buildRevalidationUrl(webBaseUrl) {
  return new URL('/api/revalidate', webBaseUrl);
}

function tryBuildUrl(value) {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`);
  } catch {
    return undefined;
  }
}

export function isPublicWebDeploymentTarget({
  deploymentTargetUrl,
  webBaseUrl,
}) {
  const targetUrl = tryBuildUrl(deploymentTargetUrl);

  if (!targetUrl) {
    return true;
  }

  const webUrl = tryBuildUrl(webBaseUrl);
  const targetHost = targetUrl.host.toLowerCase();

  return (
    targetHost.endsWith('.vercel.app') ||
    (webUrl ? targetHost === webUrl.host.toLowerCase() : false)
  );
}

async function readResponseBodyExcerpt(response) {
  try {
    return (await response.text()).slice(0, responseBodyExcerptLimit);
  } catch (error) {
    return error instanceof Error
      ? `[failed to read response body: ${error.message}]`
      : '[failed to read response body]';
  }
}

function getErrorDiagnostics(error) {
  const cause =
    error instanceof Error && 'cause' in error ? error.cause : undefined;

  return {
    causeCode:
      typeof cause === 'object' &&
      cause !== null &&
      'code' in cause &&
      typeof cause.code === 'string'
        ? cause.code
        : undefined,
    causeMessage:
      cause instanceof Error
        ? cause.message
        : typeof cause === 'object' &&
            cause !== null &&
            'message' in cause &&
            typeof cause.message === 'string'
          ? cause.message
          : undefined,
    errorMessage:
      error instanceof Error ? error.message : String(error ?? 'Unknown error'),
    errorName: error instanceof Error ? error.name : typeof error,
  };
}

export async function runPostDeployPublicWebRevalidation({
  environment = process.env,
  fetchImpl = fetch,
} = {}) {
  const config = resolvePostDeployRevalidationConfig(environment);

  if (!config.productionDeployment) {
    console.info('[post-deploy-public-web-revalidation] skipped', {
      deployment_environment: config.deploymentEnvironment || 'missing',
      reason: 'non_production_deployment',
    });

    return { attempted: false, skipped: true };
  }

  if (
    !isPublicWebDeploymentTarget({
      deploymentTargetUrl: config.deploymentTargetUrl,
      webBaseUrl: config.webBaseUrl,
    })
  ) {
    console.info('[post-deploy-public-web-revalidation] skipped', {
      deployment_environment: config.deploymentEnvironment,
      deployment_target_url: config.deploymentTargetUrl,
      reason: 'non_public_web_deployment',
    });

    return { attempted: false, skipped: true };
  }

  if (config.missingEnvNames.length > 0) {
    throw new Error(
      `Missing env for production post-deploy public web revalidation: ${config.missingEnvNames.join(
        ', ',
      )}.`,
    );
  }

  let targetUrl;

  try {
    targetUrl = buildRevalidationUrl(config.webBaseUrl);
  } catch (error) {
    console.error('[post-deploy-public-web-revalidation] invalid origin', {
      deployment_environment: config.deploymentEnvironment,
      error_message:
        error instanceof Error
          ? error.message
          : String(error ?? 'Unknown error'),
      origin_env_name: 'WEB_BASE_URL',
    });

    throw error;
  }

  console.info('[post-deploy-public-web-revalidation] request', {
    deployment_environment: config.deploymentEnvironment,
    path_count: revalidationPaths.length,
    paths: revalidationPaths,
    reason: revalidationReason,
    tag_count: revalidationTags.length,
    tags: revalidationTags,
    target_host: targetUrl.host,
    target_pathname: targetUrl.pathname,
  });

  let response;

  try {
    response = await fetchImpl(targetUrl.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-revalidate-secret': config.secret,
      },
      body: JSON.stringify({
        paths: revalidationPaths,
        reason: revalidationReason,
        tags: revalidationTags,
      }),
    });
  } catch (error) {
    const errorDiagnostics = getErrorDiagnostics(error);

    console.error('[post-deploy-public-web-revalidation] fetch failed', {
      error_cause_code: errorDiagnostics.causeCode,
      error_cause_message: errorDiagnostics.causeMessage,
      error_message: errorDiagnostics.errorMessage,
      error_name: errorDiagnostics.errorName,
      target_host: targetUrl.host,
      target_pathname: targetUrl.pathname,
    });

    throw error;
  }

  if (!response.ok) {
    const bodyExcerpt = await readResponseBodyExcerpt(response);

    console.error('[post-deploy-public-web-revalidation] http failed', {
      response_body_excerpt: bodyExcerpt,
      status: response.status,
      target_host: targetUrl.host,
      target_pathname: targetUrl.pathname,
    });

    throw new Error(
      `Production post-deploy public web revalidation failed with status ${response.status}.`,
    );
  }

  console.info('[post-deploy-public-web-revalidation] succeeded', {
    path_count: revalidationPaths.length,
    reason: revalidationReason,
    status: response.status,
    tag_count: revalidationTags.length,
    target_host: targetUrl.host,
    target_pathname: targetUrl.pathname,
  });

  return {
    attempted: true,
    pathCount: revalidationPaths.length,
    skipped: false,
    status: response.status,
    tagCount: revalidationTags.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPostDeployPublicWebRevalidation().catch((error) => {
    console.error('[post-deploy-public-web-revalidation] failed visibly', {
      error_message:
        error instanceof Error
          ? error.message
          : String(error ?? 'Unknown error'),
      error_name: error instanceof Error ? error.name : typeof error,
    });
    process.exitCode = 1;
  });
}
