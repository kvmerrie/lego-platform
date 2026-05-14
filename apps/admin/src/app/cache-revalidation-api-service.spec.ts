import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { afterEach, vi } from 'vitest';
import { CommerceAdminApiService } from '@lego-platform/commerce/feature-admin';

describe('CommerceAdminApiService cache revalidation', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  function createService() {
    TestBed.configureTestingModule({
      providers: [
        CommerceAdminApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    return {
      httpMock: TestBed.inject(HttpTestingController),
      service: TestBed.inject(CommerceAdminApiService),
    };
  }

  test('posts to the admin API without depending on browser process env', async () => {
    vi.stubGlobal('process', undefined);
    window.localStorage.setItem(
      'sb-test-project-auth-token',
      JSON.stringify({
        access_token: 'browser-access-token',
      }),
    );
    const { httpMock, service } = createService();
    const requestPromise = service.revalidatePublicWebCache({
      paths: ['/'],
      reason: 'manual_homepage_fix',
      tags: ['homepage'],
    });

    const request = httpMock.expectOne('/api/admin/cache/revalidate');

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer browser-access-token',
    );
    expect(request.request.body).toEqual({
      paths: ['/'],
      reason: 'manual_homepage_fix',
      tags: ['homepage'],
    });

    request.flush({
      durationMs: 12,
      pathCount: 1,
      paths: ['/'],
      reason: 'manual_homepage_fix',
      results: [],
      status: 'success',
      tagCount: 1,
      tags: ['homepage'],
      warnings: [],
    });

    await expect(requestPromise).resolves.toMatchObject({
      status: 'success',
    });
    httpMock.verify();
  });
});
