import { timingSafeEqual } from 'node:crypto';

const EDITORIAL_PAGE_PATH_PREFIX = '/pages/';
const EDITORIAL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type HomepagePreviewTarget = {
  kind: 'homepage';
  path: '/';
};

type EditorialPagePreviewTarget = {
  kind: 'page';
  path: string;
  slug: string;
};

export type EditorialPreviewTarget =
  | EditorialPagePreviewTarget
  | HomepagePreviewTarget;

function isValidEditorialSlug(slug: string | null): slug is string {
  return Boolean(slug && EDITORIAL_SLUG_PATTERN.test(slug));
}

export function isValidPreviewSecret(secret: string | null): boolean {
  const expectedSecret = process.env.CONTENTFUL_PREVIEW_SECRET;

  if (!secret || !expectedSecret) {
    return false;
  }

  const receivedBuffer = Buffer.from(secret);
  const expectedBuffer = Buffer.from(expectedSecret);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function getEditorialPreviewTarget(
  searchParams: URLSearchParams,
): EditorialPreviewTarget | null {
  const pageType = searchParams.get('pageType');
  const slug = searchParams.get('slug');

  if (pageType === 'homepage' && !slug) {
    return {
      kind: 'homepage',
      path: '/',
    };
  }

  if (!pageType && isValidEditorialSlug(slug)) {
    return {
      kind: 'page',
      path: `${EDITORIAL_PAGE_PATH_PREFIX}${slug}`,
      slug,
    };
  }

  return null;
}

export function getSafePreviewRedirectPath(path: string | null): string {
  if (!path) {
    return '/';
  }

  if (path === '/') {
    return path;
  }

  if (!path.startsWith(EDITORIAL_PAGE_PATH_PREFIX)) {
    return '/';
  }

  const slug = path.slice(EDITORIAL_PAGE_PATH_PREFIX.length);

  return isValidEditorialSlug(slug) ? path : '/';
}
