import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { APP_CONFIG } from './services/app-config.service';
import { environment } from './environments/environment';
import { authInterceptor } from './core/interceptors/auth.interceptor';

import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import MyPreset from './_primeng/mypreset';

import { PRIME_NG_TR } from './_primeng/primeng-locales';

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
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: APP_CONFIG, useValue: environment },
  ],
};
