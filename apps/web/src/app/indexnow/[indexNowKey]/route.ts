import { getIndexNowConfig } from '@lego-platform/shared/config';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ indexNowKey: string }> },
): Promise<Response> {
  const { indexNowKey } = await params;

  let config: ReturnType<typeof getIndexNowConfig>;

  try {
    config = getIndexNowConfig();
  } catch {
    return new Response('Not found', {
      status: 404,
    });
  }

  if (indexNowKey !== config.key) {
    return new Response('Not found', {
      status: 404,
    });
  }

  return new Response(config.key, {
    headers: {
      'cache-control': 'public, max-age=300, s-maxage=3600',
      'content-type': 'text/plain; charset=utf-8',
    },
  });
}
