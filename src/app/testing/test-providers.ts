import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentProviders, Provider } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';

import { APP_CONFIG, AppConfig } from '../core/services/app-config.service';

export const TEST_APP_CONFIG: AppConfig = {
  production: false,
  appVersion: 'test',
  USERDATA_KEY: 'test-key',
  isMockEnabled: false,
  isAuthEnabled: true,
  apiUrl: 'http://localhost:1323',
  reportBaseUrl: 'http://localhost:1323',
  photoBaseUrl: 'http://localhost/photos',
};

/**
 * Bileşen testleri için ortak altyapı: sahte HTTP, çeviri servisi, uygulama ayarı ve bildirim.
 * Servisler gerçek HTTP'ye gitmesin diye ya bu sağlayıcıyla (istek yanıtsız kalır)
 * ya da servis stub'ıyla birlikte kullanılmalıdır.
 */
export function provideAppTesting(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    provideTranslateService(),
    MessageService,
    { provide: APP_CONFIG, useValue: TEST_APP_CONFIG },
  ];
}
