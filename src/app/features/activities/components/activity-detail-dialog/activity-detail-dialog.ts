import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';

import {
  ActivityApprovalStats,
  ActivityInterface,
  ActivityParticipant,
} from '../../../../core/models/activity.model';
import {
  ColumnCellDirective,
  ColumnDef,
  CustomizableTableComponent,
} from '../../../../shared/components/customizable-table/customizable-table';
import { ActivityService } from '../../services/activity.service';

/** Katılımcı durum filtreleri — onay kartlarıyla eşleşir. */
type ParticipantFilter = 'Tümü' | ActivityParticipant['durum'];

/**
 * Etkinlik detay diyaloğu: onay istatistikleri (sp_EtkinlikOnayCampus_s) ve katılımcı listesi
 * (sp_EtkinlikKatilimcilari_s). Sayfa `open(activity)` ile açar; veriyi bileşen kendisi yükler.
 */
@Component({
  selector: 'app-activity-detail-dialog',
  standalone: true,
  imports: [
    TranslatePipe,
    ButtonModule,
    DialogModule,
    TagModule,
    CustomizableTableComponent,
    ColumnCellDirective,
  ],
  templateUrl: './activity-detail-dialog.html',
  styleUrl: './activity-detail-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityDetailDialogComponent {
  private activityService = inject(ActivityService);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);

  isDetailVisible = signal(false);
  selectedActivity = signal<ActivityInterface | null>(null);
  approvalStats = signal<ActivityApprovalStats | null>(null);
  isLoadingStats = signal(false);
  approvalError = signal<string | null>(null);
  participants = signal<ActivityParticipant[]>([]);
  isLoadingParticipants = signal(false);
  participantError = signal<string | null>(null);

  /** Katılımcı listesi için aktif filtre — onay kartlarından seçilir. */
  activeParticipantFilter = signal<ParticipantFilter>('Tümü');

  /** Aktif filtreye göre filtrelenmiş katılımcı listesi. */
  filteredParticipants = computed(() => {
    const filter = this.activeParticipantFilter();
    const list = this.participants();
    return filter === 'Tümü' ? list : list.filter((p) => p.durum === filter);
  });

  /** Katılımcı tablosu sütun tanımları — filtreler başlıkta olduğu için filterable: false */
  participantColumns: ColumnDef<ActivityParticipant>[] = [
    { field: 'ogrenci', header: 'ACTIVITIES.COLUMN_STUDENT', sortable: true, filterable: false },
    {
      field: 'sinif',
      header: 'ACTIVITIES.COLUMN_CLASSROOM',
      sortable: true,
      width: '100px',
      filterable: false,
    },
    { field: 'veli', header: 'ACTIVITIES.COLUMN_PARENT', sortable: true, filterable: false },
    { field: 'telefon', header: 'ACTIVITIES.COLUMN_PHONE', width: '120px', filterable: false },
    {
      field: 'durum',
      header: 'ACTIVITIES.STATUS',
      sortable: true,
      width: '110px',
      filterable: false,
    },
  ];

  /** Etkinliği seçip diyaloğu açar; istatistikleri ve katılımcıları çeker. */
  open(activity: ActivityInterface) {
    this.activeParticipantFilter.set('Tümü');
    this.selectedActivity.set(activity);
    this.isDetailVisible.set(true);
    this.loadApprovalStats(activity.id);
    this.loadParticipants(activity.id);
  }

  closeDetailDialog() {
    this.isDetailVisible.set(false);
    this.selectedActivity.set(null);
    this.approvalStats.set(null);
    this.approvalError.set(null);
    this.participants.set([]);
    this.participantError.set(null);
  }

  /** sp_EtkinlikOnayCampus_s'ten o etkinliğin onay istatistiklerini çeker. */
  loadApprovalStats(etkinlikId: number) {
    this.isLoadingStats.set(true);
    this.approvalError.set(null);
    this.activityService
      .getApprovalStats(etkinlikId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => {
          this.approvalStats.set(stats);
          this.isLoadingStats.set(false);
        },
        error: (err) => {
          console.error('[ActivityDetailDialog] getApprovalStats error:', err);
          this.approvalError.set(this.translate.instant('ACTIVITIES.ERROR_LOAD_APPROVAL'));
          this.isLoadingStats.set(false);
        },
      });
  }

  /** sp_EtkinlikKatilimcilari_s'ten o etkinliğin katılımcılarını çeker. */
  loadParticipants(etkinlikId: number) {
    this.isLoadingParticipants.set(true);
    this.participantError.set(null);
    this.activityService
      .getParticipants(etkinlikId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.participants.set(list);
          this.isLoadingParticipants.set(false);
        },
        error: (err) => {
          console.error('[ActivityDetailDialog] getParticipants error:', err);
          this.participantError.set(this.translate.instant('ACTIVITIES.ERROR_LOAD_PARTICIPANTS'));
          this.isLoadingParticipants.set(false);
        },
      });
  }

  /** Katılımcı durumu için p-tag severity değeri. */
  getParticipantSeverity(durum: string) {
    switch (durum) {
      case 'Onaylanan':
        return 'success';
      case 'Reddedilen':
        return 'danger';
      default:
        return 'warn'; // Bekleyen
    }
  }

  /** Onay kartına tıklanınca katılımcı listesini filtreler. */
  setParticipantFilter(filter: ParticipantFilter) {
    this.activeParticipantFilter.set(filter);
  }
}
