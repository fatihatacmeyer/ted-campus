import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { SelectModule } from 'primeng/select';
import { AppLang, LanguageService } from '../../../core/services/language.service';
import { FlagIconComponent } from './flag-icon';

interface LangOption {
  label: string;
  value: AppLang;
}

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [FormsModule, SelectModule, TranslatePipe, FlagIconComponent],
  templateUrl: './language-switcher.html',
  styleUrl: './language-switcher.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSwitcherComponent implements OnInit {
  private languageService = inject(LanguageService);

  protected currentLang?: AppLang;

  protected readonly langOptions: LangOption[] = [
    { label: 'Türkçe', value: 'tr' },
    { label: 'English', value: 'en' },
  ];

  protected get selectedOption(): LangOption | undefined {
    return this.langOptions.find((o) => o.value === this.currentLang);
  }

  ngOnInit(): void {
    this.currentLang = this.languageService.getCurrentLang();
  }

  onLangChange(lang: AppLang): void {
    this.languageService.setLanguage(lang);
  }
}

