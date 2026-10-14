import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  DestroyRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CustomizableTableComponent,
  ColumnCellDirective,
  ColumnDef,
  FilterOption,
  uniqueFilterOptions,
} from '../../../../shared/components/customizable-table/customizable-table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ActivityInterface } from '../../../../core/models/activity.model';
import { ActivityService } from '../../services/activity.service';
import { ActivityLookups } from '../../services/activity-lookups.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header';
import { ActivityDetailDialogComponent } from '../../components/activity-detail-dialog/activity-detail-dialog';
import { ActivityFormDialogComponent } from '../../components/activity-form-dialog/activity-form-dialog';

/** Boole sütun filtreleri için Evet/Hayır seçenekleri */
const BOOLEAN_FILTER_OPTIONS: FilterOption[] = [
  { label: 'COMMON.YES', value: true },
  { label: 'COMMON.NO', value: false },
];

/**
 * Etkinlik listesi sayfası: tablo ve satır işlemleri. Ekle/düzenle formu ve detay (onay durumu +
 * katılımcılar) kendi diyalog bileşenlerinde yaşar.
 */
@Component({
  selector: 'app-activities',
  standalone: true,
  imports: [
    PageHeaderComponent,
    CustomizableTableComponent,
    ColumnCellDirective,
    ButtonModule,
    TagModule,
    TooltipModule,
    TranslatePipe,
    ActivityFormDialogComponent,
    ActivityDetailDialogComponent,
  ],
  providers: [ActivityLookups],
  templateUrl: './activities-list.html',
  styleUrls: ['./activities-list.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivitiesComponent {
  private activityService = inject(ActivityService);
  private destroyRef = inject(DestroyRef);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);

  private readonly formDialog = viewChild.required(ActivityFormDialogComponent);
  private readonly detailDialog = viewChild.required(ActivityDetailDialogComponent);

  activities = signal<ActivityInterface[]>([]);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  activityColumns: ColumnDef<ActivityInterface>[] = [
    { field: 'id', header: 'ID', sortable: true, width: '70px' },
    { field: 'name', header: 'ACTIVITIES.NAME', sortable: true },
    {
      field: 'activityType',
      header: 'ACTIVITIES.TYPE',
      sortable: true,
      filterType: 'select',
      filterOptions: (rows) => uniqueFilterOptions(rows, 'activityType'),
    },
    { field: 'startDate', header: 'ACTIVITIES.DATE', sortable: true, width: '110px' },
    { field: 'endDate', header: 'ACTIVITIES.COLUMN_END_DATE', sortable: true, width: '110px' },
    { field: 'eventManager', header: 'ACTIVITIES.COLUMN_MANAGER' },
    { field: 'classroom', header: 'ACTIVITIES.COLUMN_CLASSROOM' },
    {
      field: 'status',
      header: 'ACTIVITIES.STATUS',
      sortable: true,
      width: '100px',
      filterType: 'select',
      filterOptions: (rows) => uniqueFilterOptions(rows, 'status'),
    },
    {
      field: 'requestStartDate',
      header: 'ACTIVITIES.COLUMN_REQUEST_START',
      sortable: true,
      width: '130px',
    },
    {
      field: 'requestEndDate',
      header: 'ACTIVITIES.COLUMN_REQUEST_END',
      sortable: true,
      width: '130px',
    },
    { field: 'maxStudentCount', header: 'ACTIVITIES.COLUMN_MAX_STUDENT', sortable: true },
    { field: 'studentParentCount', header: 'ACTIVITIES.COLUMN_PARENT_COUNT' },
    {
      field: 'isPaid',
      header: 'ACTIVITIES.COLUMN_PAID',
      filterType: 'select',
      filterOptions: BOOLEAN_FILTER_OPTIONS,
    },
    { field: 'fee', header: 'ACTIVITIES.COLUMN_FEE' },
    {
      field: 'isParentRequired',
      header: 'ACTIVITIES.COLUMN_PARENT_REQUIRED',
      filterType: 'select',
      filterOptions: BOOLEAN_FILTER_OPTIONS,
    },
    { field: 'transportation', header: 'ACTIVITIES.COLUMN_TRANSPORTATION' },
    { field: 'description', header: 'ACTIVITIES.DESCRIPTION' },
    {
      field: 'isPrivate',
      header: 'ACTIVITIES.COLUMN_PRIVATE',
      filterType: 'select',
      filterOptions: BOOLEAN_FILTER_OPTIONS,
    },
    { field: 'createdAt', header: 'ACTIVITIES.COLUMN_CREATED_AT' },
  ];
  defaultActivityFields = [
    'name',
    'activityType',
    'startDate',
    'eventManager',
    'classroom',
    'status',
  ];

  constructor() {
    this.loadActivities();
  }

  /** sp_etkinlikcampus_s'ten gerçek listeyi çeker. */
  loadActivities(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.activityService
      .getActivities()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.activities.set(list);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('[ActivitiesComponent] loadActivities error:', err);
          this.errorMessage.set(this.translate.instant('ACTIVITIES.ERROR_LOAD'));
          this.isLoading.set(false);
        },
      });
  }

  openAddDialog() {
    this.formDialog().openAdd();
  }

  openEditDialog(activity: ActivityInterface) {
    this.formDialog().openEdit(activity);
  }

  /** Tablo satırına tıklandığında detay diyaloğunu açar. */
  openDetailDialog(activity: ActivityInterface) {
    this.detailDialog().open(activity);
  }

  deleteActivity(id: number) {
    if (!confirm(this.translate.instant('ACTIVITIES.CONFIRM_DELETE_ACTIVITY'))) {
      return;
    }
    this.errorMessage.set(null);
    this.activityService
      .deleteActivity(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadActivities();
          this.notification.notifyDeleted();
        },
        error: (err) => {
          console.error('[ActivitiesComponent] delete error:', err);
          this.errorMessage.set(this.translate.instant('ACTIVITIES.ERROR_DELETE'));
          this.notification.error('NOTIFICATIONS.MESSAGES.SAVE_FAILED');
        },
      });
  }

  getSeverity(status: string) {
    switch (status) {
      case 'Aktif':
        return 'success';
      case 'Pasif':
        return 'warn';
      case 'İptal':
        return 'danger';
      default:
        return 'info';
    }
  }
}
