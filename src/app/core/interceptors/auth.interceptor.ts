import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

export const SILENT_ERROR = new HttpContextToken<boolean>(() => false);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/Login')) {
    return next(req);
  }

  const authService = inject(AuthService);
  const notificationService = inject(NotificationService);
  const user = authService.currentUserValue;

  const outgoing = user?.tokenid
    ? req.clone({ setHeaders: { Authorization: user.tokenid } })
    : req;

  return next(outgoing).pipe(
    catchError((error: HttpErrorResponse) => {
      if (!req.context.get(SILENT_ERROR)) {
        if (error.status === 401 || error.status === 403) {
          notificationService.error('NOTIFICATIONS.MESSAGES.UNAUTHORIZED');
          authService.logout();
        } else if (error.status === 0) {
          notificationService.error('NOTIFICATIONS.MESSAGES.NETWORK_ERROR');
        } else if (error.status >= 500) {
          notificationService.error('NOTIFICATIONS.MESSAGES.SYSTEM_ERROR');
        }
      }
      return throwError(() => error);
    }),
  );
};
