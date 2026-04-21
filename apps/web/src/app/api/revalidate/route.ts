import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import {
  getPublicWebRevalidationConfig,
  hasPublicWebRevalidationConfig,
} from '@lego-platform/shared/config';

export const dynamic = 'force-dynamic';

interface RevalidationRequestBody {
  paths?: unknown;
  reason?: unknown;
}

function normalizePathname(pathname: string): string | undefined {
  const trimmedPathname = pathname.trim();

  if (!trimmedPathname.startsWith('/')) {
    return undefined;
  }

  return trimmedPathname === '/'
    ? trimmedPathname
    : trimmedPathname.replace(/\/+$/, '') || '/';
}

function readRevalidationSecret(request: Request): string {
  const headerSecret = request.headers.get('x-revalidate-secret');

  if (headerSecret) {
    return headerSecret;
  }

  const authorizationHeader = request.headers.get('authorization');

  if (authorizationHeader?.startsWith('Bearer ')) {
    return authorizationHeader.slice('Bearer '.length).trim();
  }

  return '';
}

export async function POST(request: Request) {
  if (!hasPublicWebRevalidationConfig()) {
    return NextResponse.json(
      {
        error: 'Public web revalidation is not configured.',
      },
      {
        status: 503,
      },
    );
  }

  const revalidationConfig = getPublicWebRevalidationConfig();
  const providedSecret = readRevalidationSecret(request);

  if (!providedSecret || providedSecret !== revalidationConfig.secret) {
    return NextResponse.json(
      {
        error: 'Invalid revalidation secret.',
      },
      {
        status: 401,
      },
    );
  }

  let body: RevalidationRequestBody;

  try {
    body = (await request.json()) as RevalidationRequestBody;
  } catch {
    return NextResponse.json(
      {
        error: 'Invalid JSON payload.',
      },
      {
        status: 400,
      },
    );
  }

  const paths = Array.isArray(body.paths)
    ? [
        ...new Set(
          body.paths
            .filter(
              (pathname): pathname is string => typeof pathname === 'string',
            )
            .map(normalizePathname)
            .filter((pathname): pathname is string => Boolean(pathname)),
        ),
      ]
    : [];

  if (paths.length === 0) {
    return NextResponse.json(
      {
        error: 'Provide at least one valid path to revalidate.',
      },
      {
        status: 400,
      },
    );
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({
    pathCount: paths.length,
    paths,
    reason: typeof body.reason === 'string' ? body.reason : undefined,
    revalidated: true,
  });
}
