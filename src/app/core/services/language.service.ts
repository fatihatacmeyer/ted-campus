import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PrimeNG } from 'primeng/config';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { PRIME_NG_TR, PRIME_NG_EN } from '../primeng/primeng-locales';

export type AppLang = 'tr' | 'en';

export const SUPPORTED_LANGS: AppLang[] = ['tr', 'en'];

const LANG_STORAGE_KEY = 'ted_lang';

/**
 * Dil yönetimi: ngx-translate, PrimeNG locale ve tarayıcı başlığını
 * tek noktadan senkronize eder. Seçim localStorage'da kalıcıdır.
 */
@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private translateService = inject(TranslateService);
  private primeNG = inject(PrimeNG);
  private router = inject(Router);

  /** Aktif route'un document.title için kullandığı i18n anahtarı. */
  private titleKey = 'APP.TITLE';

  /** Uygulama başlangıcında bir kez çağrılır (app initializer). */
  init(): void {
    this.applyLang(this.readInitialLang());
    this.trackRouteTitles();
  }

  getCurrentLang(): AppLang {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    return saved === 'en' || saved === 'tr' ? saved : 'tr';
  }

  setLanguage(lang: AppLang): void {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    this.applyLang(lang);
    this.updateTitle(this.titleKey);
  }

  /** Kayıtlı tercih → tarayıcı dili → 'tr' fallback. */
  private readInitialLang(): AppLang {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'tr' || saved === 'en') return saved;

    const browser = (navigator.language || 'tr').toLowerCase();
    return browser.startsWith('en') ? 'en' : 'tr';
  }

  private applyLang(lang: AppLang): void {
    this.translateService.use(lang);
    this.primeNG.setTranslation(lang === 'tr' ? PRIME_NG_TR : PRIME_NG_EN);
  }

  private trackRouteTitles(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.readTitleFromRoute());

    this.translateService.onLangChange.subscribe(() => this.updateTitle(this.titleKey));
  }

  /** Route verisindeki titleKey'i (data.titleKey) bulur; yoksa APP.TITLE. */
  private readTitleFromRoute(): void {
    let route = this.router.routerState.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    this.titleKey = route.snapshot.data['titleKey'] ?? 'APP.TITLE';
    this.updateTitle(this.titleKey);
  }

  private updateTitle(key: string): void {
    this.translateService.get(key).subscribe((translated: string) => {
      document.title = `${translated} | TED`;
    });
  }
}
