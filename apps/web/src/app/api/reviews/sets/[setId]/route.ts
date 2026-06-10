import {
  getCatalogSetReviewsPayload,
  softDeleteCatalogSetReview,
  upsertCatalogSetReview,
  CatalogSetReviewAccessError,
} from '@lego-platform/reviews/data-access-server';
import { CatalogSetReviewValidationError } from '@lego-platform/reviews/util';
import {
  buildCatalogSetDetailCacheTags,
  buildSetDetailPath,
  cacheTags,
} from '@lego-platform/shared/config';
import { resolveRequestPrincipalFromAuthHeader } from '@lego-platform/shared/data-access-auth-server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function revalidateCatalogSetReviews({
  setId,
  slug,
}: {
  setId: string;
  slug?: string;
}) {
  if (slug) {
    revalidatePath(buildSetDetailPath(slug));

    for (const tag of buildCatalogSetDetailCacheTags({ setId, slug })) {
      revalidateTag(tag, 'max');
    }
  } else {
    revalidateTag(cacheTags.set(setId), 'max');
  }

  revalidateTag(cacheTags.reviews(), 'max');
  revalidateTag(cacheTags.setReviews(setId), 'max');
}

function toErrorResponse(error: unknown) {
  if (error instanceof CatalogSetReviewValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof CatalogSetReviewAccessError) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { error: 'De beoordeling kon nu niet worden verwerkt.' },
    { status: 500 },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ setId: string }> },
) {
  const { setId } = await params;
  const principal = await resolveRequestPrincipalFromAuthHeader(
    request.headers.get('authorization') ?? undefined,
  );

  try {
    const payload = await getCatalogSetReviewsPayload({
      setId,
      userId:
        principal.state === 'authenticated' ? principal.userId : undefined,
    });

    return NextResponse.json(payload, {
      headers: {
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ setId: string }> },
) {
  const { setId } = await params;
  const principal = await resolveRequestPrincipalFromAuthHeader(
    request.headers.get('authorization') ?? undefined,
  );

  if (principal.state !== 'authenticated') {
    return NextResponse.json(
      { error: 'Log in om je beoordeling te plaatsen.' },
      { status: 401 },
    );
  }

  try {
    const result = await upsertCatalogSetReview({
      input: (await request.json()) as never,
      setId,
      userId: principal.userId,
    });

    if (result.publicReviewChanged) {
      revalidateCatalogSetReviews({ setId, slug: result.setSlug });
    }

    return NextResponse.json(result.payload, {
      headers: {
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ setId: string }> },
) {
  const { setId } = await params;
  const principal = await resolveRequestPrincipalFromAuthHeader(
    request.headers.get('authorization') ?? undefined,
  );

  if (principal.state !== 'authenticated') {
    return NextResponse.json(
      { error: 'Log in om je beoordeling te verwijderen.' },
      { status: 401 },
    );
  }

  try {
    const result = await softDeleteCatalogSetReview({
      setId,
      userId: principal.userId,
    });

    if (result.publicReviewChanged) {
      revalidateCatalogSetReviews({ setId, slug: result.setSlug });
    }

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
