interface PartnerBadgePlaygroundRuntimeEnvironment {
  [key: string]: string | undefined;
  APP_ENV?: string;
  BRICKHUNT_DEPLOY_ENV?: string;
  BRICKHUNT_ENV?: string;
  NODE_ENV?: string;
  VERCEL_ENV?: string;
}

const productionEnvironmentNames = new Set(['prod', 'production']);

function normalizeRuntimeValue(value?: string): string | undefined {
  const normalizedValue = value?.trim().toLowerCase();

  return normalizedValue || undefined;
}

function getDeploymentEnvironment(
  environment: PartnerBadgePlaygroundRuntimeEnvironment,
): string | undefined {
  return normalizeRuntimeValue(
    environment.BRICKHUNT_DEPLOY_ENV ??
      environment.BRICKHUNT_ENV ??
      environment.APP_ENV ??
      environment.VERCEL_ENV,
  );
}

export function isPartnerBadgePlaygroundEnabled(
  environment: PartnerBadgePlaygroundRuntimeEnvironment = process.env,
): boolean {
  const deploymentEnvironment = getDeploymentEnvironment(environment);

  if (deploymentEnvironment) {
    return !productionEnvironmentNames.has(deploymentEnvironment);
  }

  const nodeEnvironment = normalizeRuntimeValue(environment.NODE_ENV);

  return Boolean(nodeEnvironment && nodeEnvironment !== 'production');
}
