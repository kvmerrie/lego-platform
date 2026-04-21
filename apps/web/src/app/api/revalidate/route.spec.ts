import { beforeEach, describe, expect, test, vi } from 'vitest';

const revalidatePath = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath,
}));

describe('web revalidation route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    revalidatePath.mockReset();
  });

  test('rejects invalid secrets', async () => {
    process.env.WEB_REVALIDATE_SECRET = 'expected-secret';
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': 'wrong-secret',
        },
        body: JSON.stringify({
          paths: ['/sets/rivendell-10316'],
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  test('revalidates each normalized path when the request is authorized', async () => {
    process.env.WEB_REVALIDATE_SECRET = 'expected-secret';
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost:3000/api/revalidate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': 'expected-secret',
        },
        body: JSON.stringify({
          paths: [
            '/sets/rivendell-10316/',
            '/themes/icons',
            '/themes',
            '/themes/icons',
          ],
          reason: 'catalog_bulk_onboarding',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledTimes(3);
    expect(revalidatePath).toHaveBeenNthCalledWith(1, '/sets/rivendell-10316');
    expect(revalidatePath).toHaveBeenNthCalledWith(2, '/themes/icons');
    expect(revalidatePath).toHaveBeenNthCalledWith(3, '/themes');
  });
});
