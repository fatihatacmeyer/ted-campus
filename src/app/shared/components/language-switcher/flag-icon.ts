import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AppLang } from '../../../core/services/language.service';

/**
 * Ülke bayraklarını gömülü SVG olarak çizer.
 * Emoji bayraklar Windows tarayıcılarda render edilmediği için SVG kullanılır.
 */
@Component({
  selector: 'app-flag-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="flag"
      role="img"
      [attr.aria-label]="lang === 'tr' ? 'Türkiye' : 'United Kingdom'"
    >
      @if (lang === 'tr') {
        <svg viewBox="0 0 640 480" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect width="640" height="480" fill="#e30a17" />
          <circle cx="224" cy="240" r="120" fill="#fff" />
          <circle cx="256" cy="240" r="96" fill="#e30a17" />
          <polygon
            fill="#fff"
            points="425,240 394.6,229.4 393.9,197.2 374.4,222.9 343.6,213.5 362,240 343.6,266.5 374.4,257.1 393.9,282.8 394.6,250.6"
          />
        </svg>
      } @else {
        <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <rect width="60" height="30" fill="#012169" />
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6" />
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#c8102e" stroke-width="2.5" />
          <rect x="25" width="10" height="30" fill="#fff" />
          <rect y="10" width="60" height="10" fill="#fff" />
          <rect x="27" width="6" height="30" fill="#c8102e" />
          <rect y="12" width="60" height="6" fill="#c8102e" />
        </svg>
      }
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        vertical-align: middle;
        line-height: 1;
      }

      .flag {
        display: inline-flex;
        height: 1em;
        aspect-ratio: 3 / 2;
        border-radius: 3px;
        overflow: hidden;
        flex-shrink: 0;
        background: #e9e9ee;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
      }

      svg {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class FlagIconComponent {
  @Input({ required: true }) lang!: AppLang;
}
