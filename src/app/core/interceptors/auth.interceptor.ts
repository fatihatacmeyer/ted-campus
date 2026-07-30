import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

/**
 * Automatically attaches the user's auth token to outgoing HTTP requests.
 * Excludes the login endpoint (which doesn't need an auth header).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Login endpoint doesn't need an auth token
  if (req.url.includes('/Login')) {
    return next(req);
  }

  const authService = inject(AuthService);
  const user = authService.currentUserValue;

  if (user?.tokenid) {
    const cloned = req.clone({
      setHeaders: { Authorization: user.tokenid },
    });
    return next(cloned);
  }

  return next(req);
};
