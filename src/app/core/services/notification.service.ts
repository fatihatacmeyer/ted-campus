import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';

type ToastSeverity = 'success' | 'info' | 'warn' | 'error';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private messageService = inject(MessageService);
  private translateService = inject(TranslateService);

  success(keyOrMessage: string): void {
    this.show('success', keyOrMessage);
  }

  error(keyOrMessage: string): void {
    this.show('error', keyOrMessage);
  }

  info(keyOrMessage: string): void {
    this.show('info', keyOrMessage);
  }

  warning(keyOrMessage: string): void {
    this.show('warn', keyOrMessage);
  }

  notifyAdded(): void {
    this.success('NOTIFICATIONS.MESSAGES.RECORD_ADDED');
  }

  notifyUpdated(): void {
    this.success('NOTIFICATIONS.MESSAGES.RECORD_UPDATED');
  }

  notifyDeleted(): void {
    this.success('NOTIFICATIONS.MESSAGES.RECORD_DELETED');
  }

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

  private resolve(keyOrMessage: string): string {
    if (!keyOrMessage) return '';
    const translated = this.translateService.instant(keyOrMessage);
    return translated !== keyOrMessage ? translated : keyOrMessage;
  }
}
