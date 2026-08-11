import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

type ToastSeverity = 'success' | 'info' | 'warn' | 'error';

/**
 * Global kullanıcı bildirimleri için soyutlama katmanı.
 *
 * Component'ler doğrudan PrimeNG MessageService yerine bu servisi kullanır;
 * böylece çeviri (i18n), başlık üretimi ve ortak bildirim desenleri (kayıt
 * eklendi/güncellendi/silindi, sunucu hata mesajı) tek yerde toplanır.
 *
 * `keyOrMessage` parametresi bir i18n anahtarı (örn. 'NOTIFICATIONS.MESSAGES.RECORD_ADDED')
 * ya da doğrudan bir metin olabilir: önce çeviri aranır, anahtar bulunamazsa
 * değer ham string olarak gösterilir (örn. backend'den gelen `sunucucevap`).
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  /** Başarılı işlem bildirimi. */
  success(keyOrMessage: string): void {
    this.show('success', keyOrMessage);
  }

  /** Hata bildirimi. */
  error(keyOrMessage: string): void {
    this.show('error', keyOrMessage);
  }

  /** Bilgilendirme bildirimi. */
  info(keyOrMessage: string): void {
    this.show('info', keyOrMessage);
  }

  /** Uyarı bildirimi. */
  warning(keyOrMessage: string): void {
    this.show('warn', keyOrMessage);
  }

  /**
   * "Kayıt başarıyla eklendi." kısayolu.
   * Anahtar: NOTIFICATIONS.MESSAGES.RECORD_ADDED
   */
  notifyAdded(): void {
    this.success('NOTIFICATIONS.MESSAGES.RECORD_ADDED');
  }

  /**
   * "Kayıt başarıyla güncellendi." kısayolu.
   * Anahtar: NOTIFICATIONS.MESSAGES.RECORD_UPDATED
   */
  notifyUpdated(): void {
    this.success('NOTIFICATIONS.MESSAGES.RECORD_UPDATED');
  }

  /**
   * "Kayıt başarıyla silindi." kısayolu.
   * Anahtar: NOTIFICATIONS.MESSAGES.RECORD_DELETED
   */
  notifyDeleted(): void {
    this.success('NOTIFICATIONS.MESSAGES.RECORD_DELETED');
  }

  /**
   * Backend hata mesajı (sunucucevap) varsa onu, yoksa fallback anahtarı gösterir.
   * @param serverMessage Backend'den gelen ham hata metni (boş/undefined olabilir).
   * @param fallbackKey serverMessage yoksa kullanılacak i18n anahtarı.
   */
  notifyServerError(serverMessage: string | null | undefined, fallbackKey: string): void {
    const detail = serverMessage?.trim() ? serverMessage.trim() : this.resolve(fallbackKey);
    this.show('error', detail);
  }

  private show(severity: ToastSeverity, keyOrMessage: string): void {
    const detail = this.resolve(keyOrMessage);
    if (!detail) return;

    this.messageService.add({
      severity,
      summary: this.resolve(`NOTIFICATIONS.${severity.toUpperCase()}`),
      detail,
      life: 3000,
    });
  }

  /**
   * Anahtar → çevrilmiş metin; anahtar bulunamazsa (veya boşsa) ham değeri döner.
   * ngx-translate `instant()` çeviri bulamadığında anahtarın kendisini döndürdüğü
   * için, dönen değer anahtarla aynıysa ham string olarak kabul edilir.
   */
  private resolve(keyOrMessage: string): string {
    if (!keyOrMessage) return '';
    const translated = this.translateService.instant(keyOrMessage);
    return translated !== keyOrMessage ? translated : keyOrMessage;
  }
}
