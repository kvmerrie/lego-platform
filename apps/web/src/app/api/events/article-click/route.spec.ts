import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const logArticleClickEvent = vi.fn();

vi.mock('@lego-platform/content/data-access', () => ({
  logArticleClickEvent,
}));

function createRequest(body: unknown) {
  return new NextRequest('https://brickhunt.test/api/events/article-click', {
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
    method: 'POST',
  });
}

describe('article click event route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    logArticleClickEvent.mockResolvedValue(undefined);
  });

  it('stores a valid article click event', async () => {
    const { POST } = await import('./route');

    const response = await POST(
      createRequest({
        slug: 'star-wars-day-2026',
      }),
    );

    expect(response.status).toBe(204);
    expect(logArticleClickEvent).toHaveBeenCalledWith({
      slug: 'star-wars-day-2026',
    });
  });

  it('rejects invalid article slugs', async () => {
    const { POST } = await import('./route');

    const response = await POST(
      createRequest({
        slug: '../nope',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: 'Ongeldige artikel-slug.',
    });
    expect(logArticleClickEvent).not.toHaveBeenCalled();
  });
});
