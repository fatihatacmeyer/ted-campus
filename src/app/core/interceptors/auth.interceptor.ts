import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

/**
 * Bu token'ı true yapan isteklerde interceptor hata toast'u göstermez.
 * Çağrı noktası (component/service) hatayı kendisi ele alıp kullanıcıya
 * özel bir mesaj gösterdiğinde çift toast'u önlemek için kullanılır.
 *
 * Kullanım:
 *   this.api.callEndpoint<T>('Dynamic', params, {
 *     context: new HttpContext().set(SILENT_ERROR, true),
 *   });
 */
export const SILENT_ERROR = new HttpContextToken<boolean>(() => false);

/**
 * Outgoing isteklere otomatik olarak kullanıcının auth token'ını ekler.
 * Login endpoint'ini hariç tutar (auth header'ı gerektirmez).
 *
 * Ayrıca HTTP hatalarını global ölçekte normalize eder:
 *   - 401/403  → UNAUTHORIZED toast + logout (oturum geçersiz/eksik)
 *   - status 0 → NETWORK_ERROR toast (sunucuya ulaşılamadı / CORS / timeout)
 *   - 5xx      → SYSTEM_ERROR toast (beklenmeyen sunucu hatası)
 *   - diğer 4xx → toast GÖSTERMEZ: iş hataları çağrı noktasında ele alınır
 *
 * Hata her durumda aşağıya (caller'a) yeniden fırlatılır; çağrı noktası
 * kendi hata akışını (inline errorMessage vb.) kaybetmez.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Login endpoint'i token ve hata toast'u gerektirmez
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
