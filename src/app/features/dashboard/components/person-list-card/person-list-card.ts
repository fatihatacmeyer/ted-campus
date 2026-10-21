import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';

import { filterPeople } from '../../utils/dashboard.utils';
import { SearchBoxComponent } from '../search-box/search-box';

const PREVIEW_LIMIT = 5;

export type PersonListKind = 'early' | 'late' | 'absent';

export interface PersonListItem {
  fullName: string;
  className: string;
  schoolName: string;
  exitTime?: string;
  expectedExitTime?: string;
  entryTime?: string;
  expectedEntryTime?: string;
}

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

  protected readonly search = signal('');
  protected readonly dialogVisible = signal(false);

  protected readonly filtered = computed(() => filterPeople(this.people(), this.search()));
  protected readonly preview = computed(() => this.filtered().slice(0, PREVIEW_LIMIT));
  protected readonly extra = computed(() => Math.max(0, this.filtered().length - PREVIEW_LIMIT));
}
