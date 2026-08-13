import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { SelectButtonModule } from 'primeng/selectbutton';

import { AuthService } from '../../../../../core/services/auth.service';
import { AppLang, LanguageService } from '../../../../../core/services/language.service';

interface LangOption {
  label: string;
  value: AppLang;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SelectButtonModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent implements OnInit {
  private authService = inject(AuthService);
  private languageService = inject(LanguageService);

  protected currentLang: AppLang = 'tr';

  protected readonly langOptions: LangOption[] = [
    { label: 'TR', value: 'tr' },
    { label: 'EN', value: 'en' },
  ];

  ngOnInit(): void {
    this.currentLang = this.languageService.getCurrentLang();
  }

  onLangChange(lang: AppLang): void {
    this.languageService.setLanguage(lang);
  }

  logout(): void {
    this.authService.logout();
  }
}
