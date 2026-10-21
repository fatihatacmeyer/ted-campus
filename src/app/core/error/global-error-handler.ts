import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    // TODO(prod): hata izleme servisine raporla (örn. Sentry, Rollbar).
    console.error('[GlobalErrorHandler] Yakalanmamış hata:', error);
  }
}
