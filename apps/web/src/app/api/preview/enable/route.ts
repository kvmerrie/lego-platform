import {
  getEditorialPageBySlug,
  getHomepagePage,
} from '@lego-platform/content/data-access';
import { draftMode } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  getEditorialPreviewTarget,
  isValidPreviewSecret,
} from '../lib/preview-utils';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const previewTarget = getEditorialPreviewTarget(requestUrl.searchParams);

  if (!isValidPreviewSecret(requestUrl.searchParams.get('secret'))) {
    return new NextResponse('Invalid preview secret.', {
      status: 401,
    });
  }

  if (!previewTarget) {
    return new NextResponse('Invalid preview target.', {
      status: 400,
    });
  }

  try {
    if (previewTarget.kind === 'homepage') {
      await getHomepagePage({
        mode: 'preview',
      });
    } else {
      const editorialPage = await getEditorialPageBySlug(previewTarget.slug, {
        mode: 'preview',
      });

      if (!editorialPage) {
        return new NextResponse('Preview page not found.', {
          status: 404,
        });
      }
    }
  } catch {
    return new NextResponse('Unable to enable preview mode.', {
      status: 500,
    });
  }

  const draftModeState = await draftMode();

  draftModeState.enable();

  return NextResponse.redirect(new URL(previewTarget.path, requestUrl));
}
