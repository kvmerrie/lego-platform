import {
  buildSupabaseAuthorizationHeaders,
  notifyBrowserAccountDataChanged,
} from '@lego-platform/shared/data-access-auth';
import {
  type CatalogSetReviewInput,
  type CatalogSetReviewsPayload,
  toCatalogSetReviewApiPath,
} from '@lego-platform/reviews/util';

export async function getCatalogSetReviewsForBrowser(
  setId: string,
): Promise<CatalogSetReviewsPayload> {
  const headers = await buildSupabaseAuthorizationHeaders();
  const response = await fetch(toCatalogSetReviewApiPath(setId), {
    headers,
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('De beoordelingen konden nu niet worden geladen.');
  }

  return (await response.json()) as CatalogSetReviewsPayload;
}

export async function upsertCatalogSetReviewForBrowser(
  setId: string,
  input: CatalogSetReviewInput,
): Promise<CatalogSetReviewsPayload> {
  const headers = await buildSupabaseAuthorizationHeaders({
    'content-type': 'application/json',
  });
  const response = await fetch(toCatalogSetReviewApiPath(setId), {
    body: JSON.stringify(input),
    headers,
    method: 'PUT',
  });

  if (response.status === 401) {
    throw new Error('Log in om je beoordeling te plaatsen.');
  }

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => undefined)) as
      | { error?: string }
      | undefined;

    throw new Error(
      errorPayload?.error ?? 'Je beoordeling kon niet worden opgeslagen.',
    );
  }

  notifyBrowserAccountDataChanged();

  return (await response.json()) as CatalogSetReviewsPayload;
}
