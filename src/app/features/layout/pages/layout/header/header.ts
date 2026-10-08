import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../../../../core/services/auth.service';
import { AppLang, LanguageService } from '../../../../../core/services/language.service';
import { FlagIconComponent } from '../../../../../shared/components/language-switcher/flag-icon';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [TranslatePipe, FlagIconComponent],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  private authService = inject(AuthService);
  private languageService = inject(LanguageService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly menuOpen = signal(false);
  protected readonly currentLang = signal<AppLang>(this.languageService.getCurrentLang());

  protected readonly langOptions: { label: string; value: AppLang }[] = [
    { label: 'Türkçe', value: 'tr' },
    { label: 'English', value: 'en' },
  ];

  protected readonly user = this.authService.currentUserValue;

  protected readonly displayName = computed(
    () => this.user?.fullname || this.user?.username || this.user?.loginname || '',
  );

  protected readonly initials = computed(() => {
    const parts = this.displayName().trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toLocaleUpperCase('tr');
  });

  protected readonly subtitle = computed(() =>
    this.user?.gorev ?? '',
  );

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  setLang(lang: AppLang): void {
    this.languageService.setLanguage(lang);
    this.currentLang.set(lang);
  }

  logout(): void {
    this.menuOpen.set(false);
    this.authService.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.menuOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.menuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen.set(false);
  }
}
