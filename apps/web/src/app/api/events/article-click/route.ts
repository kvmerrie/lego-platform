import { logArticleClickEvent } from '@lego-platform/content/data-access';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ARTICLE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function readArticleClickSlug(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const slug = (value as Record<string, unknown>)['slug'];

  return typeof slug === 'string' ? slug.trim() : undefined;
}

function isValidArticleSlug(slug?: string): slug is string {
  return (
    typeof slug === 'string' &&
    slug.length > 0 &&
    slug.length <= 140 &&
    ARTICLE_SLUG_PATTERN.test(slug)
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        message: 'Ongeldige event payload.',
      },
      {
        status: 400,
      },
    );
  }

  const slug = readArticleClickSlug(body);

  if (!isValidArticleSlug(slug)) {
    return NextResponse.json(
      {
        message: 'Ongeldige artikel-slug.',
      },
      {
        status: 400,
      },
    );
  }

  try {
    await logArticleClickEvent({
      slug,
    });
  } catch {
    return NextResponse.json(
      {
        message: 'Artikel-event opslaan is mislukt.',
      },
      {
        status: 500,
      },
    );
  }

  return new NextResponse(null, {
    status: 204,
  });
}
