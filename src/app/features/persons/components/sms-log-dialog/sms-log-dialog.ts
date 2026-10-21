import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import {
  ColumnCellDirective,
  ColumnDef,
  CustomizableTableComponent,
} from '../../../../shared/components/customizable-table/customizable-table';
import { formatDate } from '../../../../shared/utils/date.utils';
import { SmsLog, SmsLogStatus } from '../../models/sms-log.model';
import { SmsLogError, SmsLogService } from '../../services/sms-log.service';

interface SmsLogTableRow extends SmsLog {
  createdAtText: string;
  sentAtText: string;
}

type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

type RangePreset = '7' | '30' | 'all' | 'custom';

export const SMS_LOG_LIMIT = 200;

const STATUS_LABELS: Record<SmsLogStatus, string> = {
  [SmsLogStatus.Bekliyor]: 'SMS_LOG.STATUS_PENDING',
  [SmsLogStatus.Gonderiliyor]: 'SMS_LOG.STATUS_SENDING',
  [SmsLogStatus.Gonderildi]: 'SMS_LOG.STATUS_SENT',
  [SmsLogStatus.Basarisiz]: 'SMS_LOG.STATUS_FAILED',
};

const STATUS_SEVERITY: Record<SmsLogStatus, TagSeverity> = {
  [SmsLogStatus.Bekliyor]: 'secondary',
  [SmsLogStatus.Gonderiliyor]: 'info',
  [SmsLogStatus.Gonderildi]: 'success',
  [SmsLogStatus.Basarisiz]: 'danger',
};

const STATUS_ORDER: SmsLogStatus[] = [
  SmsLogStatus.Gonderildi,
  SmsLogStatus.Basarisiz,
  SmsLogStatus.Bekliyor,
  SmsLogStatus.Gonderiliyor,
];

@Component({
  selector: 'app-sms-log-dialog',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    ButtonModule,
    DatePickerModule,
    DialogModule,
    TagModule,
    TooltipModule,
    CustomizableTableComponent,
    ColumnCellDirective,
  ],
  templateUrl: './sms-log-dialog.html',
  styleUrl: './sms-log-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmsLogDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() sicilId: number | null = null;
  @Input() vekilCampusId: number | null = null;
  @Input() personName = '';

  @Output() visibleChange = new EventEmitter<boolean>();

  private smsLogService = inject(SmsLogService);
  private destroyRef = inject(DestroyRef);
  private request?: Subscription;

  protected readonly rows = signal<SmsLogTableRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly activeStatus = signal<SmsLogStatus | null>(null);
  protected readonly preset = signal<RangePreset>('all');
  protected startDate: Date | null = null;
  protected endDate: Date | null = null;

  protected readonly limit = SMS_LOG_LIMIT;

  protected readonly presets: { value: Exclude<RangePreset, 'custom'>; label: string }[] = [
    { value: '7', label: 'SMS_LOG.RANGE_7' },
    { value: '30', label: 'SMS_LOG.RANGE_30' },
    { value: 'all', label: 'SMS_LOG.RANGE_ALL' },
  ];

  protected readonly statusCounts = computed(() => {
    const counts = new Map<SmsLogStatus, number>();
    for (const row of this.rows()) counts.set(row.durum, (counts.get(row.durum) ?? 0) + 1);
    return STATUS_ORDER.filter((s) => counts.has(s)).map((s) => ({
      status: s,
      count: counts.get(s) ?? 0,
    }));
  });

  protected readonly filteredRows = computed(() => {
    const status = this.activeStatus();
    const rows = this.rows();
    return status === null ? rows : rows.filter((r) => r.durum === status);
  });

  protected readonly limitReached = computed(() => this.rows().length >= SMS_LOG_LIMIT);

  protected readonly columns: ColumnDef<SmsLogTableRow>[] = [
    { field: 'createdAtText', header: 'SMS_LOG.COL_CREATED', alwaysVisible: true },
    { field: 'telefon', header: 'SMS_LOG.COL_PHONE' },
    {
      field: 'durum',
      header: 'SMS_LOG.COL_STATUS',
      sortable: true,
      exportValue: (row) => row.durumAciklama,
    },
    { field: 'retryCount', header: 'SMS_LOG.COL_RETRY', sortable: true, width: '90px' },
    { field: 'sentAtText', header: 'SMS_LOG.COL_SENT' },
    { field: 'gatewayCevap', header: 'SMS_LOG.COL_GATEWAY' },
  ];

  get isProxy(): boolean {
    return !!this.vekilCampusId;
  }

  ngOnChanges(changes: SimpleChanges): void {
    const opened = changes['visible'] && this.visible;
    const targetChanged = changes['sicilId'] || changes['vekilCampusId'];
    if (this.visible && (opened || targetChanged)) {
      this.resetFilters();
      this.load();
    }
  }

  protected load(): void {
    this.request?.unsubscribe();
    this.errorMessage.set('');
    this.loading.set(true);

    this.request = this.smsLogService
      .getSmsLog({
        sicilId: this.sicilId,
        vekilCampusId: this.vekilCampusId,
        baslangic: formatDate(this.startDate) || null,
        bitis: formatDate(this.endDate) || null,
        adet: SMS_LOG_LIMIT,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (logs) => {
          this.rows.set(
            logs.map((log) => ({
              ...log,
              createdAtText: this.formatDateTime(log.createdAt),
              sentAtText: this.formatDateTime(log.sentAt),
            })),
          );
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.rows.set([]);
          this.loading.set(false);
          this.errorMessage.set(
            err instanceof SmsLogError && err.message ? err.message : 'SMS_LOG.LOAD_ERROR',
          );
        },
      });
  }

  protected selectPreset(preset: Exclude<RangePreset, 'custom'>): void {
    this.preset.set(preset);
    if (preset === 'all') {
      this.startDate = null;
      this.endDate = null;
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(today);
      start.setDate(start.getDate() - (Number(preset) - 1));
      this.startDate = start;
      this.endDate = today;
    }
    this.load();
  }

  protected onDateChange(): void {
    this.preset.set(this.startDate || this.endDate ? 'custom' : 'all');
  }

  protected toggleStatus(status: SmsLogStatus | null): void {
    this.activeStatus.set(this.activeStatus() === status ? null : status);
  }

  protected statusLabel(status: SmsLogStatus): string {
    return STATUS_LABELS[status] ?? 'SMS_LOG.STATUS_UNKNOWN';
  }

  protected statusSeverity(status: SmsLogStatus): TagSeverity {
    return STATUS_SEVERITY[status] ?? 'secondary';
  }

  protected close(): void {
    this.request?.unsubscribe();
    this.visible = false;
    this.visibleChange.emit(false);
  }

  private resetFilters(): void {
    this.activeStatus.set(null);
    this.preset.set('all');
    this.startDate = null;
    this.endDate = null;
  }

  private formatDateTime(value: string | null): string {
    if (!value) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value);
    return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}` : value;
  }
}
