import { InjectionToken, isDevMode } from '@angular/core';
import { environment } from '../../environments/environment';

export interface AppConfig {
  production: boolean;
  appVersion: string;
  USERDATA_KEY: string;
  isMockEnabled: boolean;
  isAuthEnabled: boolean;
  apiUrl: string;
  reportBaseUrl: string;
  photoBaseUrl: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

export interface RuntimeConfig {
  apiUrl?: string;
  reportBaseUrl?: string;
  photoBaseUrl?: string;
}

export async function loadRuntimeConfig(): Promise<void> {
  if (isDevMode()) {
    return;
  }

  try {
    const response = await fetch('config.json');
    if (!response.ok) {
      console.warn(
        `[AppConfig] config.json bulunamadı (${response.status}); environment değerleri kullanılacak.`,
      );
      return;
    }
    const runtime: RuntimeConfig = await response.json();
    if (runtime.apiUrl !== undefined) {
      environment.apiUrl = runtime.apiUrl;
    }
    if (runtime.reportBaseUrl !== undefined) {
      environment.reportBaseUrl = runtime.reportBaseUrl;
    }
    if (runtime.photoBaseUrl !== undefined) {
      environment.photoBaseUrl = runtime.photoBaseUrl;
    }
  } catch (error) {
    console.warn(
      '[AppConfig] config.json okunurken hata oluştu; environment değerleri kullanılacak.',
      error,
    );
  }
}

export function appConfigFactory(): AppConfig {
  return environment;
}
