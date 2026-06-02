import { timingSafeEqual } from 'node:crypto';
import type {
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from 'fastify';
import type { RequestPrincipal } from '@lego-platform/shared/data-access-auth-server';

export type AdminAuthorizationActor =
  | {
      email: string | null;
      id: string;
      kind: 'bearer_session';
    }
  | {
      email: null;
      id: 'admin-secret';
      kind: 'admin_secret';
    };

export type AdminAuthorizationResult =
  | {
      actor: AdminAuthorizationActor;
      authorized: true;
    }
  | {
      authorized: false;
      message: string;
      statusCode: 401 | 403;
    };

export interface AdminAuthorizationOptions {
  allowMachineSecret?: boolean;
  getAllowedEmails?: () => readonly string[];
  getAllowedRoles?: () => readonly string[];
  getExpectedMachineSecret?: () => string | undefined;
}

function readDelimitedValues(value?: string): string[] {
  return (value ?? '')
    .split(/[,\s]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readDefaultAllowedEmails(): string[] {
  return [
    ...readDelimitedValues(process.env['ADMIN_EMAIL_ALLOWLIST']),
    ...readDelimitedValues(process.env['ADMIN_ALLOWED_EMAILS']),
  ].map((email) => email.toLowerCase());
}

function readDefaultAllowedRoles(): string[] {
  const explicitRoles = readDelimitedValues(process.env['ADMIN_ALLOWED_ROLES']);

  return explicitRoles.length > 0 ? explicitRoles : ['admin'];
}

export function readAdminSecretHeader(
  headerValue: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(headerValue)) {
    return typeof headerValue[0] === 'string'
      ? headerValue[0].trim()
      : undefined;
  }

  return typeof headerValue === 'string' ? headerValue.trim() : undefined;
}

export function matchesAdminSecret({
  expectedSecret,
  providedSecret,
}: {
  expectedSecret?: string;
  providedSecret?: string;
}): boolean {
  if (!expectedSecret || !providedSecret) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedSecret, 'utf8');
  const providedBuffer = Buffer.from(providedSecret, 'utf8');

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function hasAdminClaim(
  appMetadata: Record<string, unknown> | undefined,
  allowedRoles: readonly string[],
): boolean {
  if (!appMetadata) {
    return false;
  }

  if (appMetadata['is_admin'] === true || appMetadata['admin'] === true) {
    return true;
  }

  const role = appMetadata['role'];

  if (
    typeof role === 'string' &&
    allowedRoles.includes(role.trim().toLowerCase())
  ) {
    return true;
  }

  const roles = appMetadata['roles'];

  return (
    Array.isArray(roles) &&
    roles.some(
      (item) =>
        typeof item === 'string' &&
        allowedRoles.includes(item.trim().toLowerCase()),
    )
  );
}

export function isAdminPrincipal(
  requestPrincipal: RequestPrincipal | null,
  {
    getAllowedEmails = readDefaultAllowedEmails,
    getAllowedRoles = readDefaultAllowedRoles,
  }: Pick<
    AdminAuthorizationOptions,
    'getAllowedEmails' | 'getAllowedRoles'
  > = {},
): requestPrincipal is Extract<RequestPrincipal, { state: 'authenticated' }> {
  if (requestPrincipal?.state !== 'authenticated') {
    return false;
  }

  const allowedEmails = getAllowedEmails().map((email) =>
    email.trim().toLowerCase(),
  );
  const allowedRoles = getAllowedRoles().map((role) =>
    role.trim().toLowerCase(),
  );
  const email = requestPrincipal.email?.trim().toLowerCase();

  return (
    Boolean(email && allowedEmails.includes(email)) ||
    (Boolean(requestPrincipal.role) &&
      allowedRoles.includes(requestPrincipal.role.trim().toLowerCase())) ||
    hasAdminClaim(requestPrincipal.appMetadata, allowedRoles)
  );
}

export function authorizeAdminRequest({
  allowMachineSecret = false,
  getAllowedEmails,
  getAllowedRoles,
  getExpectedMachineSecret,
  providedMachineSecret,
  requestPrincipal,
}: AdminAuthorizationOptions & {
  providedMachineSecret?: string;
  requestPrincipal: RequestPrincipal | null;
}): AdminAuthorizationResult {
  let expectedMachineSecret: string | undefined;

  try {
    expectedMachineSecret = getExpectedMachineSecret?.();
  } catch {
    expectedMachineSecret = undefined;
  }

  if (
    allowMachineSecret &&
    matchesAdminSecret({
      expectedSecret: expectedMachineSecret,
      providedSecret: providedMachineSecret,
    })
  ) {
    return {
      actor: {
        email: null,
        id: 'admin-secret',
        kind: 'admin_secret',
      },
      authorized: true,
    };
  }

  if (!requestPrincipal || requestPrincipal.state === 'anonymous') {
    return {
      authorized: false,
      message: 'Admin authentication is required.',
      statusCode: 401,
    };
  }

  if (
    isAdminPrincipal(requestPrincipal, {
      getAllowedEmails,
      getAllowedRoles,
    })
  ) {
    return {
      actor: {
        email: requestPrincipal.email,
        id: requestPrincipal.userId,
        kind: 'bearer_session',
      },
      authorized: true,
    };
  }

  return {
    authorized: false,
    message: 'Admin access is required.',
    statusCode: 403,
  };
}

export function createAdminPreHandler({
  allowMachineSecret = false,
  getAllowedEmails,
  getAllowedRoles,
  getExpectedMachineSecret,
}: AdminAuthorizationOptions = {}): preHandlerHookHandler {
  return async function requireAdminAuthorization(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const authorization = authorizeAdminRequest({
      allowMachineSecret,
      getAllowedEmails,
      getAllowedRoles,
      getExpectedMachineSecret,
      providedMachineSecret: readAdminSecretHeader(
        request.headers['x-admin-secret'],
      ),
      requestPrincipal: request.requestPrincipal,
    });

    if (authorization.authorized === true) {
      return;
    }

    return reply.status(authorization.statusCode).send({
      message: authorization.message,
      status: 'error',
    });
  };
}
