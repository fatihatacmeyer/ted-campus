import { Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

export function boldText(value: string | null | undefined): string {
  const escaped = String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return `<strong>${escaped}</strong>`;
}

export function injectI18nVersion(): Signal<unknown> {
  const translate = inject(TranslateService);
  return toSignal(
    merge(translate.onLangChange, translate.onTranslationChange).pipe(
      map(() => translate.currentLang),
      startWith(translate.currentLang),
    ),
  );
}
