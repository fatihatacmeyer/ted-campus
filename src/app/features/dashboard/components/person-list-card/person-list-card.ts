import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';

import { filterPeople } from '../../utils/dashboard.utils';
import { SearchBoxComponent } from '../search-box/search-box';

/** Özet kartlarında gösterilecek maksimum satır sayısı. */
const PREVIEW_LIMIT = 5;

export type PersonListKind = 'early' | 'late' | 'absent';

/** Erken çıkan / geç kalan / gelmeyen kayıtlarının ortak alanları (saatler türe göre dolu). */
export interface PersonListItem {
  fullName: string;
  className: string;
  schoolName: string;
  exitTime?: string;
  expectedExitTime?: string;
  entryTime?: string;
  expectedEntryTime?: string;
}

/**
 * Kişi listesi kartı: başlık, arama, ilk birkaç satır ve "tümünü gör" diyaloğu.
 * Erken çıkanlar, geç kalanlar ve gelmeyenler için aynı bileşen kullanılır.
 */
@Component({
  selector: 'app-person-list-card',
  standalone: true,
  imports: [
    DatePipe,
    NgTemplateOutlet,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    TooltipModule,
    SearchBoxComponent,
  ],
  templateUrl: './person-list-card.html',
  styleUrl: './person-list-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonListCardComponent {
  readonly people = input.required<PersonListItem[]>();
  readonly kind = input.required<PersonListKind>();
  readonly titleKey = input.required<string>();
  readonly emptyKey = input.required<string>();
  readonly icon = input.required<string>();
  readonly iconCls = input.required<string>();

  /** Kart ve diyalog aynı arama metnini paylaşır. */
  protected readonly search = signal('');
  protected readonly dialogVisible = signal(false);

  protected readonly filtered = computed(() => filterPeople(this.people(), this.search()));
  protected readonly preview = computed(() => this.filtered().slice(0, PREVIEW_LIMIT));
  protected readonly extra = computed(() => Math.max(0, this.filtered().length - PREVIEW_LIMIT));
}
