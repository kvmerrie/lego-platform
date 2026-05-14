import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import {
  CommerceAdminApiService,
  CommerceAdminCacheRevalidationPageComponent,
  type CommerceAdminCacheRevalidationResult,
} from '@lego-platform/commerce/feature-admin';

function createResult(
  overrides: Partial<CommerceAdminCacheRevalidationResult> = {},
): CommerceAdminCacheRevalidationResult {
  return {
    durationMs: 42,
    pathCount: 2,
    paths: ['/', '/deals'],
    reason: 'homepage_hotfix',
    results: [
      {
        batchIndex: 0,
        pathCount: 2,
        paths: ['/', '/deals'],
        responseBody: {
          revalidated: true,
        },
        status: 200,
        success: true,
        tagCount: 2,
        tags: ['homepage', 'deals'],
      },
    ],
    status: 'success',
    tagCount: 2,
    tags: ['homepage', 'deals'],
    warnings: [],
    ...overrides,
  };
}

describe('CommerceAdminCacheRevalidationPageComponent', () => {
  async function createFixture({
    revalidatePublicWebCache = vi.fn(async () => createResult()),
  }: {
    revalidatePublicWebCache?: CommerceAdminApiService['revalidatePublicWebCache'];
  } = {}) {
    await TestBed.configureTestingModule({
      imports: [CommerceAdminCacheRevalidationPageComponent],
      providers: [
        {
          provide: CommerceAdminApiService,
          useValue: {
            revalidatePublicWebCache,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(
      CommerceAdminCacheRevalidationPageComponent,
    );

    fixture.detectChanges();

    return {
      component: fixture.componentInstance,
      fixture,
      revalidatePublicWebCache,
    };
  }

  test('renders validation warnings for invalid paths', async () => {
    const { component, fixture } = await createFixture();

    component.updatePaths('https://www.brickhunt.nl/deals');
    fixture.detectChanges();

    expect(component.canSubmit()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(
      'Path must start with /',
    );
  });

  test('submits normalized paths and shows a successful response', async () => {
    const { component, fixture, revalidatePublicWebCache } =
      await createFixture();

    await component.revalidate();
    fixture.detectChanges();

    expect(revalidatePublicWebCache).toHaveBeenCalledWith({
      paths: ['/', '/deals'],
      reason: 'homepage_hotfix',
      tags: ['homepage', 'deals'],
    });
    expect(fixture.nativeElement.textContent).toContain(
      'Cache revalidation is afgerond.',
    );
    expect(fixture.nativeElement.textContent).toContain('homepage_hotfix');
  });

  test('shows loading state while the request is running', async () => {
    let resolveRequest:
      | ((result: CommerceAdminCacheRevalidationResult) => void)
      | undefined;
    const pendingRequest = new Promise<CommerceAdminCacheRevalidationResult>(
      (resolve) => {
        resolveRequest = resolve;
      },
    );
    const { component, fixture } = await createFixture({
      revalidatePublicWebCache: vi.fn(() => pendingRequest),
    });

    const requestPromise = component.revalidate();
    fixture.detectChanges();

    expect(component.isRunning()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Revalidating...');

    if (!resolveRequest) {
      throw new Error('Expected the pending request resolver to be available.');
    }

    resolveRequest(createResult());
    await requestPromise;
    fixture.detectChanges();

    expect(component.isRunning()).toBe(false);
  });

  test('renders upstream warnings', async () => {
    const { component, fixture } = await createFixture({
      revalidatePublicWebCache: vi.fn(async () =>
        createResult({
          status: 'partial_failure',
          warnings: ['Public web revalidation batch 2 failed with status 400.'],
        }),
      ),
    });

    await component.revalidate();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Public web revalidation batch 2 failed with status 400.',
    );
  });
});
