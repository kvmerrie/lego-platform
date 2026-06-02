import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { afterEach, vi } from 'vitest';
import { CommerceAdminApiService } from '@lego-platform/commerce/feature-admin';
import { adminAuthInterceptor } from './admin-auth.interceptor';
import { AdminAuthService } from './admin-auth.service';

describe('CommerceAdminApiService cache revalidation', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function createService() {
    const getAccessToken = vi.fn(async () => 'browser-access-token');

    TestBed.configureTestingModule({
      providers: [
        CommerceAdminApiService,
        {
          provide: AdminAuthService,
          useValue: {
            getAccessToken,
          },
        },
        provideHttpClient(withInterceptors([adminAuthInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    return {
      httpMock: TestBed.inject(HttpTestingController),
      getAccessToken,
      service: TestBed.inject(CommerceAdminApiService),
    };
  }

  test('posts to the admin API without depending on browser process env', async () => {
    const { getAccessToken, httpMock, service } = createService();
    const requestPromise = service.revalidatePublicWebCache({
      paths: ['/'],
      reason: 'manual_homepage_fix',
      tags: ['homepage'],
    });

    let request = httpMock.match('/api/admin/cache/revalidate')[0];

    await vi.waitFor(() => {
      request = httpMock.match('/api/admin/cache/revalidate')[0];
      expect(request).toBeTruthy();
    });

    expect(request?.request.method).toBe('POST');
    expect(request?.request.headers.get('Authorization')).toBe(
      'Bearer browser-access-token',
    );
    expect(getAccessToken).toHaveBeenCalled();
    expect(request?.request.body).toEqual({
      paths: ['/'],
      reason: 'manual_homepage_fix',
      tags: ['homepage'],
    });

    request?.flush({
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
