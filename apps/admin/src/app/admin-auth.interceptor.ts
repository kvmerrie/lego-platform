import { from, switchMap } from 'rxjs';
import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { AdminAuthService } from './admin-auth.service';

function isAdminApiRequest(url: string): boolean {
  return url.startsWith('/api/admin/') || url.startsWith('/api/v1/admin/');
}

export const adminAuthInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isAdminApiRequest(request.url)) {
    return next(request);
  }

  if (request.headers.has('Authorization')) {
    return next(request);
  }

  return from(inject(AdminAuthService).getAccessToken()).pipe(
    switchMap((accessToken) =>
      next(
        accessToken
          ? request.clone({
              setHeaders: {
                Authorization: `Bearer ${accessToken}`,
              },
            })
          : request,
      ),
    ),
  );
};
