import { AppConfig } from '../core/services/app-config.service';
import { baseEnvironment } from './environment.base';

export const environment: AppConfig = {
  ...baseEnvironment,
  production: false,
  apiUrl: '/api',
  /** PDF/rapor dosyaları için backend root URL (legacy'deki baglanti.substr(0, -3) karşılığı) */
  reportBaseUrl: 'https://meyerapi.local',
};
