import { ErrorHandler, Injectable } from '@angular/core';

/**
 * Yakalanmamış (unexpected) hatalar için global handler.
 *
 * Angular dokümantasyonuna göre ErrorHandler "operasyonel hatalar oluştuğu yerde
 * ele alınır" ilkesinin tamamlayıcısıdır: buraya sadece hiçbir katmanın
 * yakalayamadığı hatalar düşer. Kullanıcıya toast göstermek BURANIN işi değildir
 * (operasyonel hatalar interceptor/component'te ele alınır); burada hata
 * loglanır ve (üretimde) bir hata izleme servisine raporlanabilir.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    // TODO(prod): hata izleme servisine raporla (örn. Sentry, Rollbar).
    console.error('[GlobalErrorHandler] Yakalanmamış hata:', error);
  }
}
