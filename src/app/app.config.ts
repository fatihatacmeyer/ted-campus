import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { APP_CONFIG } from './core/services/app-config.service';
import { environment } from './environments/environment';
import { authInterceptor } from './core/interceptors/auth.interceptor';

import { MessageService } from 'primeng/api';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import MyPreset from './core/primeng/mypreset';

import { PRIME_NG_TR } from './core/primeng/primeng-locales';

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
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: APP_CONFIG, useValue: environment },
  ],
};
