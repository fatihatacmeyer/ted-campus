import { Component, input } from '@angular/core';

export type LastPassIconName =
  'idle' | 'user' | 'check' | 'x' | 'clock' | 'department' | 'company' | 'terminal';

/**
 * last-pass.html içinde tekrar tekrar yazılan el-yapımı SVG ikonları
 * için tek noktadan yönetilen, sade bir sunum (presentational) component'i.
 *
 * Kullanım:  <app-last-pass-icon name="clock" [size]="13" />
 */
@Component({
  selector: 'app-last-pass-icon',
  standalone: true,
  template: `
    @switch (name()) {
      @case ('idle') {
        <svg
          [attr.width]="size()"
          [attr.height]="size()"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <circle cx="12" cy="12" r="9"></circle>
          <polyline points="12 7 12 12 16 14"></polyline>
        </svg>
      }
      @case ('user') {
        <svg
          [attr.width]="size()"
          [attr.height]="size()"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <circle cx="12" cy="8" r="4"></circle>
          <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7"></path>
        </svg>
      }
      @case ('check') {
        <svg
          [attr.width]="size()"
          [attr.height]="size()"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      }
      @case ('x') {
        <svg
          [attr.width]="size()"
          [attr.height]="size()"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      }
      @case ('clock') {
        <svg
          [attr.width]="size()"
          [attr.height]="size()"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="9"></circle>
          <polyline points="12 7 12 12 16 14"></polyline>
        </svg>
      }
      @case ('department') {
        <svg
          [attr.width]="size()"
          [attr.height]="size()"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      }
      @case ('company') {
        <svg
          [attr.width]="size()"
          [attr.height]="size()"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="4" y="2" width="16" height="20" rx="1"></rect>
          <line x1="8" y1="6" x2="8" y2="6"></line>
          <line x1="12" y1="6" x2="12" y2="6"></line>
          <line x1="16" y1="6" x2="16" y2="6"></line>
          <line x1="8" y1="10" x2="8" y2="10"></line>
          <line x1="12" y1="10" x2="12" y2="10"></line>
          <line x1="16" y1="10" x2="16" y2="10"></line>
          <path d="M9 22v-4h6v4"></path>
        </svg>
      }
      @case ('terminal') {
        <svg
          [attr.width]="size()"
          [attr.height]="size()"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
          <polyline points="10 17 15 12 10 7"></polyline>
          <line x1="15" y1="12" x2="3" y2="12"></line>
        </svg>
      }
    }
  `,
})
export class LastPassIconComponent {
  name = input.required<LastPassIconName>();
  size = input<number>(24);
}
