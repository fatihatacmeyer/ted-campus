import { provideAppInitializer, ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import {
  APP_CONFIG,
  appConfigFactory,
  loadRuntimeConfig,
} from './core/services/app-config.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';

import { MessageService } from 'primeng/api';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import MyPreset from './core/primeng/mypreset';

import { PRIME_NG_TR } from './core/primeng/primeng-locales';

import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { ErrorHandler } from '@angular/core';
import { GlobalErrorHandler } from './core/error/global-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
    providePrimeNG({
      translation: PRIME_NG_TR,
      theme: {
        preset: MyPreset,
        options: {
          darkModeSelector: 'none',
        },
      },
    }),
    MessageService,
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppInitializer(() => loadRuntimeConfig()),
    { provide: APP_CONFIG, useFactory: appConfigFactory },
    provideTranslateService({
      fallbackLang: 'tr',
      lang: 'tr',
    }),
    provideTranslateHttpLoader({
      prefix: '/assets/i18n/',
      suffix: '.json',
    }),
  ],
};
