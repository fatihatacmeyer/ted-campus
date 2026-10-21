import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';

import { AccessTransaction } from '../../services/dashboard.service';
import { toLowerTr, uniqueSorted } from '../../utils/dashboard.utils';

export interface TxnFilters {
  type: string;
  className: string;
  campus: string;
  sicil: string;
  card: string;
  direction: string;
  device: string;
  range: Date[] | null;
  result: string;
}

export const EMPTY_TXN_FILTERS: TxnFilters = {
  type: '',
  className: '',
  campus: '',
  sicil: '',
  card: '',
  direction: '',
  device: '',
  range: null,
  result: '',
};

const DAY_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-transactions-table',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    DatePickerModule,
    InputTextModule,
    SelectModule,
    TooltipModule,
  ],
  templateUrl: './transactions-table.html',
  styleUrl: './transactions-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsTableComponent {
  readonly rows = input.required<AccessTransaction[]>();
  readonly translated = input(false);
  readonly filterable = input(false);
  readonly searching = input(false);
  readonly filters = model<TxnFilters>(EMPTY_TXN_FILTERS);

  protected readonly typeOptions = [
    { label: 'USERDEF.STUDENT', value: 'badge-student' },
    { label: 'USERDEF.PARENT', value: 'badge-parent' },
    { label: 'DASHBOARD.KVKK_PROXY', value: 'badge-proxy' },
  ];
  protected readonly directionOptions = [
    { label: 'DASHBOARD.DIRECTION_IN', value: 'in' },
    { label: 'DASHBOARD.DIRECTION_OUT', value: 'out' },
  ];
  protected readonly resultOptions = [
    { label: 'DASHBOARD.RESULT_SUCCESS', value: 'success' },
    { label: 'DASHBOARD.RESULT_FAILED', value: 'failed' },
    { label: 'DASHBOARD.RESULT_SERVICE', value: 'service' },
  ];

  protected readonly classOptions = computed(() =>
    uniqueSorted(this.rows().map((t) => t.className)),
  );
  protected readonly campusOptions = computed(() =>
    uniqueSorted(this.rows().map((t) => t.campusName)),
  );
  protected readonly deviceOptions = computed(() =>
    uniqueSorted(this.rows().map((t) => (t.device === '-' ? null : t.device))),
  );

  protected readonly filtersActive = computed(() => {
    const f = this.filters();
    return (Object.keys(f) as (keyof TxnFilters)[]).some((k) => !!f[k]);
  });

  protected readonly visibleRows = computed(() => {
    if (!this.filterable()) return this.rows();

    const f = this.filters();
    const sicil = toLowerTr(f.sicil.trim());
    const card = toLowerTr(f.card.trim());
    const from = f.range?.[0] ? f.range[0].getTime() : null;
    const to = from === null ? null : (f.range?.[1] ?? f.range?.[0])!.getTime() + DAY_MS;
    return this.rows().filter(
      (t) =>
        (!f.type || t.badgeClass === f.type) &&
        (!f.className || t.className === f.className) &&
        (!f.campus || t.campusName === f.campus) &&
        (!sicil || toLowerTr(t.registryNo).includes(sicil)) &&
        (!card || toLowerTr(t.cardId).includes(card)) &&
        (!f.direction || t.direction === f.direction) &&
        (!f.device || t.device === f.device) &&
        (!f.result || t.result === f.result) &&
        (from === null || (t.timestamp !== null && t.timestamp >= from && t.timestamp < to!)),
    );
  });

  protected setFilter<K extends keyof TxnFilters>(
    key: K,
    value: TxnFilters[K] | null | undefined,
  ): void {
    this.filters.update((f) => ({ ...f, [key]: value ?? EMPTY_TXN_FILTERS[key] }));
  }

  protected clearFilters(): void {
    this.filters.set(EMPTY_TXN_FILTERS);
  }

  protected directionLabel(direction: string | null): string {
    if (!direction) return 'DASHBOARD.DIRECTION_UNKNOWN';
    return direction === 'in' ? 'DASHBOARD.DIRECTION_IN' : 'DASHBOARD.DIRECTION_OUT';
  }

  protected resultLabel(result: string): string {
    switch (result) {
      case 'success':
        return 'DASHBOARD.RESULT_SUCCESS';
      case 'service':
        return 'DASHBOARD.RESULT_SERVICE';
      default:
        return 'DASHBOARD.RESULT_FAILED';
    }
  }
}
