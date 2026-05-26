import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import {
  getPublicWebRevalidationConfig,
  hasPublicWebRevalidationConfig,
  normalizeCacheTags,
} from '@lego-platform/shared/config';

export const dynamic = 'force-dynamic';

const MAX_REVALIDATION_PATHS = 25;
const MAX_REVALIDATION_TAGS = 100;
const BROAD_REVALIDATION_TAGS = new Set([
  'catalog',
  'collections',
  'homepage',
  'deals',
  'prices',
  'sitemap',
  'sets',
  'themes',
]);
const LOGGED_VALUE_LIMIT = 12;

interface RevalidationRequestBody {
  paths?: unknown;
  reason?: unknown;
  tags?: unknown;
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

function summarizeValues(values: readonly string[]): {
  omittedCount: number;
  sample: readonly string[];
} {
  return {
    omittedCount: Math.max(0, values.length - LOGGED_VALUE_LIMIT),
    sample: values.slice(0, LOGGED_VALUE_LIMIT),
  };
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
  const tags = Array.isArray(body.tags)
    ? normalizeCacheTags(
        body.tags.filter((tag): tag is string => typeof tag === 'string'),
      )
    : [];

  if (paths.length > MAX_REVALIDATION_PATHS) {
    return NextResponse.json(
      {
        error: `Provide at most ${MAX_REVALIDATION_PATHS} paths to revalidate.`,
      },
      {
        status: 400,
      },
    );
  }

  if (tags.length > MAX_REVALIDATION_TAGS) {
    return NextResponse.json(
      {
        error: `Provide at most ${MAX_REVALIDATION_TAGS} tags to revalidate.`,
      },
      {
        status: 400,
      },
    );
  }

  if (paths.length === 0 && tags.length === 0) {
    return NextResponse.json(
      {
        error: 'Provide at least one valid tag or path to revalidate.',
      },
      {
        status: 400,
      },
    );
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  for (const tag of tags) {
    revalidateTag(tag, 'max');
  }

  const broadTags = tags.filter((tag) => BROAD_REVALIDATION_TAGS.has(tag));
  const pathSummary = summarizeValues(paths);
  const tagSummary = summarizeValues(tags);

  console.info('Public web revalidation requested.', {
    broadTagCount: broadTags.length,
    pathCount: paths.length,
    pathSample: pathSummary.sample,
    pathSampleOmittedCount: pathSummary.omittedCount,
    reason: typeof body.reason === 'string' ? body.reason : undefined,
    tagCount: tags.length,
    tagSample: tagSummary.sample,
    tagSampleOmittedCount: tagSummary.omittedCount,
  });

  if (broadTags.length > 0) {
    console.warn('Public web revalidation received broad tags.', {
      broadTags,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
    });
  }

  return NextResponse.json({
    pathCount: paths.length,
    paths,
    reason: typeof body.reason === 'string' ? body.reason : undefined,
    revalidated: true,
    tagCount: tags.length,
    tags,
  });
}
