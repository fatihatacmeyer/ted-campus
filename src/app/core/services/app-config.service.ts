import { InjectionToken } from '@angular/core';

export interface AppConfig {
  production: boolean;
  appVersion: string;
  USERDATA_KEY: string;
  isMockEnabled: boolean;
  isAuthEnabled: boolean;
  apiUrl: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
