import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { TooltipModule } from 'primeng/tooltip';

import { NotificationService } from '../../../../core/services/notification.service';
import {
  ColumnCellDirective,
  ColumnDef,
  CustomizableTableComponent,
} from '../../../../shared/components/customizable-table/customizable-table';
import { Bus } from '../../models/school-bus.model';
import { BusStoreService } from '../../services/bus-store.service';
import { SchoolBusService } from '../../services/school-bus.service';
import { boldText, injectI18nVersion } from '../../utils/transport.utils';

/** Araçlar sekmesi: araç listesi, ekle/düzenle formu ve silme onayı. */
@Component({
  selector: 'app-buses-tab',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TagModule,
    TextareaModule,
    TooltipModule,
    CustomizableTableComponent,
    ColumnCellDirective,
  ],
  templateUrl: './buses-tab.html',
  styleUrl: './buses-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusesTabComponent implements OnInit {
  private fb = inject(FormBuilder);
  private busService = inject(SchoolBusService);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);
  private store = inject(BusStoreService);
  private i18nVersion = injectI18nVersion();

  protected readonly buses = this.store.buses;

  protected readonly busFormVisible = signal(false);
  protected readonly busDeleteVisible = signal(false);
  protected readonly busEditing = signal<Bus | null>(null);
  protected readonly busDeleting = signal<Bus | null>(null);

  protected readonly busForm: FormGroup = this.fb.group({
    plate: ['', Validators.required],
    brand: ['', Validators.required],
    model: ['', Validators.required],
    seatCount: [16, [Validators.required, Validators.min(1)]],
    description: [''],
    status: ['Aktif', Validators.required],
  });

  protected readonly busColumns: ColumnDef<Bus>[] = [
    { field: 'plate', header: 'SCHOOL_BUS.COL_PLATE', sortable: true },
    { field: 'brand', header: 'SCHOOL_BUS.COL_BRAND', sortable: true },
    { field: 'model', header: 'SCHOOL_BUS.COL_MODEL', sortable: true },
    { field: 'seatCount', header: 'SCHOOL_BUS.COL_SEAT_COUNT', sortable: true },
    { field: 'description', header: 'SCHOOL_BUS.COL_DESCRIPTION', sortable: true },
    { field: 'status', header: 'SCHOOL_BUS.COL_STATUS', sortable: true },
  ];

  /** `value` DB'deki durum metnidir (Aktif/Bakımda/Pasif); yalnızca etiket çevrilir. */
  protected readonly statusOptions = computed(() => {
    this.i18nVersion();
    return [
      { label: this.translate.instant('SCHOOL_BUS.STATUS_ACTIVE'), value: 'Aktif' },
      { label: this.translate.instant('SCHOOL_BUS.STATUS_MAINTENANCE'), value: 'Bakımda' },
      { label: this.translate.instant('SCHOOL_BUS.STATUS_PASSIVE'), value: 'Pasif' },
    ];
  });

  protected readonly bold = boldText;

  ngOnInit(): void {
    this.store.ensureBuses();
  }

  /** DB durum metnini çeviri anahtarına çevirir (bilinmeyen değer olduğu gibi gösterilir). */
  protected statusLabel(status: string): string {
    switch (status) {
      case 'Aktif':
        return 'SCHOOL_BUS.STATUS_ACTIVE';
      case 'Bakımda':
        return 'SCHOOL_BUS.STATUS_MAINTENANCE';
      case 'Pasif':
        return 'SCHOOL_BUS.STATUS_PASSIVE';
      default:
        return status;
    }
  }

  /** Esc: en üstte açık olan modalı kapatır (silme onayı forma göre üsttedir). */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.busDeleteVisible()) this.closeBusDelete();
    else if (this.busFormVisible()) this.closeBusForm();
  }

  openBusForm(bus?: Bus): void {
    this.busEditing.set(bus ?? null);
    if (bus) {
      this.busForm.patchValue(bus);
    } else {
      this.busForm.reset({ seatCount: 16, status: 'Aktif' });
    }
    this.busFormVisible.set(true);
  }

  protected closeBusForm(): void {
    this.busFormVisible.set(false);
    this.busEditing.set(null);
    this.busForm.reset();
  }

  submitBus(): void {
    if (this.busForm.invalid) return;
    const v = this.busForm.value;
    const editing = this.busEditing();

    const request$ = editing ? this.busService.updateBus(editing.id, v) : this.busService.addBus(v);

    request$.subscribe({
      next: (result) => {
        if (result.sonuc === 1) {
          this.notification.success(result.sunucuCevap || 'SCHOOL_BUS.MSG_OP_SUCCESS');
          this.store.loadBuses();
          this.closeBusForm();
        } else {
          this.notification.error(result.sunucuCevap || 'SCHOOL_BUS.MSG_OP_ERROR');
        }
      },
      error: () => this.notification.error('SCHOOL_BUS.MSG_SERVER_ERROR'),
    });
  }

  protected confirmBusDelete(bus: Bus): void {
    this.busDeleting.set(bus);
    this.busDeleteVisible.set(true);
  }

  protected closeBusDelete(): void {
    this.busDeleteVisible.set(false);
    this.busDeleting.set(null);
  }

  protected deleteBus(): void {
    const target = this.busDeleting();
    if (!target) return;

    this.busService.deleteBus(target.id).subscribe({
      next: (result) => {
        if (result.sonuc === 1) {
          this.notification.success(result.sunucuCevap || 'SCHOOL_BUS.MSG_BUS_DELETED');
          this.store.loadBuses();
          this.closeBusDelete();
        } else {
          this.notification.error(result.sunucuCevap || 'SCHOOL_BUS.MSG_BUS_DELETE_ERROR');
        }
      },
      error: () => this.notification.error('SCHOOL_BUS.MSG_SERVER_ERROR'),
    });
  }
}
