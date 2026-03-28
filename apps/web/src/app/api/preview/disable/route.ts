import { draftMode } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSafePreviewRedirectPath } from '../lib/preview-utils';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const redirectPath = getSafePreviewRedirectPath(
    requestUrl.searchParams.get('path'),
  );
  const draftModeState = await draftMode();

  draftModeState.disable();

  return NextResponse.redirect(new URL(redirectPath, requestUrl));
}
