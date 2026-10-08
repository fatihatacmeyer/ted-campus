import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  FormsModule,
  Validators,
} from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';

import {
  CustomizableTableComponent,
  ColumnCellDirective,
  ColumnDef,
} from '../../../../shared/components/customizable-table/customizable-table';
import { SchoolBusService } from '../../services/school-bus.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PersonService } from '../../../persons/services/person.service';
import { Person, UserDef } from '../../../../core/models/person.model';

import { forkJoin, merge, of } from 'rxjs';
import { catchError, map, startWith } from 'rxjs/operators';
import {
  Bus,
  BusDirection,
  StudentAssignment,
  BusDashboardStats,
  AuthorityAssignment,
  ServiceAuthority,
} from '../../models/school-bus.model';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header';

type TabKey = 'dashboard' | 'buses' | 'assignments' | 'authorities';

@Component({
  selector: 'app-school-bus',
  standalone: true,
  imports: [
    PageHeaderComponent,
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    TagModule,
    ButtonModule,
    TooltipModule,
    SelectModule,
    InputTextModule,
    TextareaModule,
    CustomizableTableComponent,
    ColumnCellDirective,
    FormsModule,
    TranslatePipe,
  ],
  templateUrl: './school-bus.html',
  styleUrl: './school-bus.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchoolBusComponent implements OnInit {
  private fb = inject(FormBuilder);
  private busService = inject(SchoolBusService);
  private personService = inject(PersonService);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  protected readonly activeTab = signal<TabKey>('dashboard');
  protected readonly tabs: { key: TabKey; labelKey: string; icon: string }[] = [
    { key: 'dashboard', labelKey: 'SCHOOL_BUS.TAB_DASHBOARD', icon: 'dashboard' },
    { key: 'buses', labelKey: 'SCHOOL_BUS.TAB_BUSES', icon: 'directions_bus' },
    { key: 'assignments', labelKey: 'SCHOOL_BUS.TAB_ASSIGNMENTS', icon: 'assignment' },
    { key: 'authorities', labelKey: 'SCHOOL_BUS.TAB_AUTHORITIES', icon: 'admin_panel_settings' },
  ];

  protected readonly buses = signal<Bus[]>([]);
  protected readonly students = signal<Person[]>([]);

  protected readonly busFormVisible = signal(false);
  protected readonly busDeleteVisible = signal(false);
  protected readonly busEditing = signal<Bus | null>(null);
  protected readonly busDeleting = signal<Bus | null>(null);

  protected readonly studentAssignVisible = signal(false);
  protected readonly studentAssignBus = signal<Bus | null>(null);
  protected readonly studentAssignments = signal<StudentAssignment[]>([]);
  protected readonly studentAssignLoading = signal(false);
  protected readonly studentAssignDeleteVisible = signal(false);
  protected readonly studentAssignDeleting = signal<StudentAssignment | null>(null);
  protected readonly studentAssignDirectionTab = signal<BusDirection>(1);

  protected readonly allAuthorityAssignments = signal<AuthorityAssignment[]>([]);
  protected readonly authorityAssignDeleteVisible = signal(false);
  protected readonly authorityAssignDeleting = signal<AuthorityAssignment | null>(null);
  protected readonly authorities = signal<Person[]>([]);

  /** Yetkililer sekmesi: servis yetkilileri listesi + "Bilgileri Gönder" onayı. */
  protected readonly serviceAuthorities = signal<ServiceAuthority[]>([]);
  protected readonly serviceAuthoritiesLoading = signal(false);
  protected readonly authoritySendVisible = signal(false);
  protected readonly authoritySendTarget = signal<ServiceAuthority | null>(null);
  protected readonly authoritySendLoading = signal(false);

  protected assignmentBusSearchValue = '';
  protected readonly assignmentBusSearch = signal('');
  protected readonly dashboardStats = signal<BusDashboardStats | null>(null);

  protected readonly busForm: FormGroup = this.fb.group({
    plate: ['', Validators.required],
    brand: ['', Validators.required],
    model: ['', Validators.required],
    seatCount: [16, [Validators.required, Validators.min(1)]],
    description: [''],
    status: ['Aktif', Validators.required],
  });

  protected readonly studentAssignForm: FormGroup = this.fb.group({
    studentId: [null, Validators.required],
    direction: [1, Validators.required],
  });

  protected readonly authorityAssignForm: FormGroup = this.fb.group({
    authorityId: [null, Validators.required],
  });

  protected readonly busColumns: ColumnDef<Bus>[] = [
    { field: 'plate', header: 'SCHOOL_BUS.COL_PLATE', sortable: true },
    { field: 'brand', header: 'SCHOOL_BUS.COL_BRAND', sortable: true },
    { field: 'model', header: 'SCHOOL_BUS.COL_MODEL', sortable: true },
    { field: 'seatCount', header: 'SCHOOL_BUS.COL_SEAT_COUNT', sortable: true },
    { field: 'description', header: 'SCHOOL_BUS.COL_DESCRIPTION', sortable: true },
    { field: 'status', header: 'SCHOOL_BUS.COL_STATUS', sortable: true },
  ];

  protected readonly assignedStudentColumns: ColumnDef<StudentAssignment>[] = [
    { field: 'ogrenciAdSoyad', header: 'SCHOOL_BUS.COL_STUDENT', sortable: true },
    { field: 'sinif', header: 'SCHOOL_BUS.COL_CLASS', sortable: true },
    { field: 'kampus', header: 'SCHOOL_BUS.COL_CAMPUS', sortable: true },
  ];

  protected readonly serviceAuthorityColumns: ColumnDef<ServiceAuthority>[] = [
    { field: 'adSoyad', header: 'SCHOOL_BUS.COL_FULL_NAME', sortable: true, alwaysVisible: true },
    { field: 'sicilNo', header: 'SCHOOL_BUS.COL_REG_NO', sortable: true },
    { field: 'cepTelefon', header: 'SCHOOL_BUS.COL_PHONE' },
    { field: 'email', header: 'SCHOOL_BUS.COL_EMAIL', sortable: true },
  ];

  protected readonly authorityAssignmentsForBus = (servisId: number) =>
    this.allAuthorityAssignments().filter((a) => a.servisId === servisId);

  protected readonly filteredAssignmentBuses = computed(() => {
    const term = this.assignmentBusSearch().toLowerCase();
    if (!term) return this.buses();
    return this.buses().filter(
      (b) =>
        b.plate.toLowerCase().includes(term) ||
        b.brand.toLowerCase().includes(term) ||
        b.model.toLowerCase().includes(term) ||
        (b.description || '').toLowerCase().includes(term),
    );
  });

  protected readonly studentOptions = computed(() =>
    this.students().map((s) => ({
      label: s.bolumad ? `${s.adsoyad} — ${s.bolumad}` : s.adsoyad,
      value: s.id,
    })),
  );

  protected readonly authorityOptions = computed(() =>
    this.authorities().map((y) => ({
      label: y.bolumad ? `${y.adsoyad} — ${y.bolumad}` : y.adsoyad,
      value: y.id,
    })),
  );

  /** Dil veya çeviri yüklemesi değişince seçenek etiketlerini yeniden hesaplamak için. */
  private readonly i18nVersion = toSignal(
    merge(this.translate.onLangChange, this.translate.onTranslationChange).pipe(
      map(() => this.translate.currentLang),
      startWith(this.translate.currentLang),
    ),
  );

  protected readonly directionOptions = computed(() => {
    this.i18nVersion();
    return [
      { label: this.translate.instant('SCHOOL_BUS.DIRECTION_DEPARTURE'), value: 1 },
      { label: this.translate.instant('SCHOOL_BUS.DIRECTION_RETURN'), value: 2 },
      { label: this.translate.instant('SCHOOL_BUS.DIRECTION_BOTH'), value: 3 },
    ];
  });

  /** `value` DB'deki durum metnidir (Aktif/Bakımda/Pasif); yalnızca etiket çevrilir. */
  protected readonly statusOptions = computed(() => {
    this.i18nVersion();
    return [
      { label: this.translate.instant('SCHOOL_BUS.STATUS_ACTIVE'), value: 'Aktif' },
      { label: this.translate.instant('SCHOOL_BUS.STATUS_MAINTENANCE'), value: 'Bakımda' },
      { label: this.translate.instant('SCHOOL_BUS.STATUS_PASSIVE'), value: 'Pasif' },
    ];
  });

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

  protected directionText(direction: BusDirection): string {
    return this.translate.instant(
      direction === 1 ? 'SCHOOL_BUS.DIRECTION_DEPARTURE' : 'SCHOOL_BUS.DIRECTION_RETURN',
    );
  }

  /** `[innerHTML]` çevirilerinde kullanıcı verisini kaçışlayıp kalın yazar. */
  protected bold(value: string | null | undefined): string {
    const escaped = String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return `<strong>${escaped}</strong>`;
  }

  protected checkAssignButtonDisabled(bus: Bus): boolean {
    if (this.studentAssignForm.invalid) return true;
    const direction = this.studentAssignForm.value.direction;

    if (direction === 1) return bus.bosKoltukGidis <= 0;
    if (direction === 2) return bus.bosKoltukDonus <= 0;
    if (direction === 3) return bus.bosKoltukGidis <= 0 || bus.bosKoltukDonus <= 0;

    return false;
  }

  protected readonly studentAssignDepartureList = computed(() =>
    this.studentAssignments().filter((a) => a.yon === 1),
  );
  protected readonly studentAssignReturnList = computed(() =>
    this.studentAssignments().filter((a) => a.yon === 2),
  );
  protected readonly studentAssignDepartureCount = computed(
    () => this.studentAssignDepartureList().length,
  );
  protected readonly studentAssignReturnCount = computed(
    () => this.studentAssignReturnList().length,
  );
  protected readonly studentAssignActiveList = computed(() =>
    this.studentAssignDirectionTab() === 1
      ? this.studentAssignDepartureList()
      : this.studentAssignReturnList(),
  );

  ngOnInit(): void {
    this.loadBuses();
    this.loadDashboardStats();
  }

  private loadDashboardStats(): void {
    this.busService.getDashboardStats().subscribe({
      next: (stats) => this.dashboardStats.set(stats),
      error: () => this.notification.error('SCHOOL_BUS.MSG_STATS_ERROR'),
    });
  }

  private loadBuses(): void {
    this.busService
      .getBuses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (busesData) => this.buses.set(busesData),
        error: () => this.notification.error('SCHOOL_BUS.MSG_BUSES_ERROR'),
      });
  }

  private loadStudents(): void {
    this.personService.getPersonListCampus().subscribe({
      next: (people) => this.students.set(people.filter((p) => p.userdef === UserDef.Ogrenci)),
      error: () => this.notification.error('SCHOOL_BUS.MSG_STUDENTS_ERROR'),
    });
  }

  private loadAuthorities(): void {
    this.personService.getPersonListCampus().subscribe({
      next: (people) => this.authorities.set(people.filter((p) => p.userdef === UserDef.Authority)),
      error: () => this.notification.error('SCHOOL_BUS.MSG_AUTHORITIES_ERROR'),
    });
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

  /** Esc: en üstte açık olan modalı kapatır (üstteki modallar önce). */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.studentAssignDeleteVisible()) this.closeStudentAssignDelete();
    else if (this.authorityAssignDeleteVisible()) this.closeAuthorityAssignDelete();
    else if (this.authoritySendVisible()) this.closeAuthoritySend();
    else if (this.busDeleteVisible()) this.closeBusDelete();
    else if (this.busFormVisible()) this.closeBusForm();
    else if (this.studentAssignVisible()) this.closeStudentAssign();
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
          this.loadBuses();
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
          this.loadBuses();
          this.closeBusDelete();
        } else {
          this.notification.error(result.sunucuCevap || 'SCHOOL_BUS.MSG_BUS_DELETE_ERROR');
        }
      },
      error: () => this.notification.error('SCHOOL_BUS.MSG_SERVER_ERROR'),
    });
  }

  protected openStudentAssign(bus: Bus): void {
    this.studentAssignBus.set(bus);
    this.studentAssignForm.reset({ studentId: null, direction: 1 });
    this.studentAssignDirectionTab.set(1);
    this.loadStudentAssignments(bus.id);

    if (this.students().length === 0) this.loadStudents();

    this.authorityAssignForm.reset({ authorityId: null });
    if (this.authorities().length === 0) this.loadAuthorities();

    this.studentAssignVisible.set(true);
  }

  protected setStudentAssignDirectionTab(direction: BusDirection): void {
    this.studentAssignDirectionTab.set(direction);
  }

  protected closeStudentAssign(): void {
    this.studentAssignVisible.set(false);
    this.studentAssignBus.set(null);
    this.studentAssignments.set([]);
    this.studentAssignForm.reset({ studentId: null, direction: 1 });
    this.authorityAssignForm.reset({ authorityId: null });
    this.closeAuthorityAssignDelete();
  }

  private loadStudentAssignments(servisId: number): void {
    this.studentAssignLoading.set(true);
    this.busService.getStudentAssignments({ servisId }).subscribe({
      next: (rows) => {
        this.studentAssignments.set(rows);
        this.studentAssignLoading.set(false);
      },
      error: () => {
        this.notification.error('SCHOOL_BUS.MSG_STUDENT_ASSIGNMENTS_ERROR');
        this.studentAssignLoading.set(false);
      },
    });
  }

  submitStudentAssign(): void {
    if (this.studentAssignForm.invalid) return;
    const bus = this.studentAssignBus();
    if (!bus) return;
    const v = this.studentAssignForm.value;

    if (v.direction === 3) {
      this.studentAssignLoading.set(true);
      forkJoin([
        this.busService
          .assignStudentToBus(v.studentId, bus.id, 1 as BusDirection)
          .pipe(
            catchError(() =>
              of({ sonuc: -1, sunucuCevap: 'SCHOOL_BUS.MSG_DEPARTURE_ASSIGN_ERROR' }),
            ),
          ),
        this.busService
          .assignStudentToBus(v.studentId, bus.id, 2 as BusDirection)
          .pipe(
            catchError(() => of({ sonuc: -1, sunucuCevap: 'SCHOOL_BUS.MSG_RETURN_ASSIGN_ERROR' })),
          ),
      ]).subscribe({
        next: (results) => {
          const allSuccess = results.every((res) => res.sonuc === 1);
          if (allSuccess) {
            this.notification.success('SCHOOL_BUS.MSG_ASSIGNED_BOTH');
          } else {
            this.notification.info('SCHOOL_BUS.MSG_ASSIGN_PARTIAL');
          }
          this.loadStudentAssignments(bus.id);
          this.loadBuses();
          this.studentAssignForm.reset({ studentId: null, direction: 1 });
        },
      });
    } else {
      this.busService.assignStudentToBus(v.studentId, bus.id, v.direction).subscribe({
        next: (result) => {
          if (result.sonuc === 1) {
            this.notification.success(result.sunucuCevap || 'SCHOOL_BUS.MSG_STUDENT_ASSIGNED');
            this.loadStudentAssignments(bus.id);
            this.loadBuses();
            this.studentAssignForm.reset({ studentId: null, direction: v.direction });
          } else {
            this.notification.error(result.sunucuCevap || 'SCHOOL_BUS.MSG_STUDENT_ASSIGN_ERROR');
          }
        },
        error: () => this.notification.error('SCHOOL_BUS.MSG_SERVER_ERROR_GENERIC'),
      });
    }
  }

  protected confirmStudentAssignDelete(row: StudentAssignment): void {
    this.studentAssignDeleting.set(row);
    this.studentAssignDeleteVisible.set(true);
  }

  protected closeStudentAssignDelete(): void {
    this.studentAssignDeleteVisible.set(false);
    this.studentAssignDeleting.set(null);
  }

  protected deleteStudentAssign(): void {
    const target = this.studentAssignDeleting();
    const bus = this.studentAssignBus();
    if (!target) return;

    this.busService.removeStudentAssignment(target.id).subscribe({
      next: (result) => {
        if (result.sonuc === 1) {
          this.notification.success(result.sunucuCevap || 'SCHOOL_BUS.MSG_RECORD_DELETED');
          if (bus) {
            this.loadStudentAssignments(bus.id);
            this.loadBuses();
          }
          this.closeStudentAssignDelete();
        } else {
          this.notification.error(result.sunucuCevap || 'SCHOOL_BUS.MSG_RECORD_DELETE_ERROR');
        }
      },
      error: () => this.notification.error('SCHOOL_BUS.MSG_SERVER_ERROR'),
    });
  }

  private loadAllAuthorityAssignments(): void {
    this.busService.getAuthorityAssignments().subscribe({
      next: (rows) => this.allAuthorityAssignments.set(rows),
      error: () => this.notification.error('SCHOOL_BUS.MSG_AUTHORITY_ASSIGNMENTS_ERROR'),
    });
  }

  submitAuthorityAssign(): void {
    if (this.authorityAssignForm.invalid) return;
    const bus = this.studentAssignBus();
    if (!bus) return;
    const v = this.authorityAssignForm.value;

    this.busService.assignAuthorityToBus(v.authorityId, bus.id).subscribe({
      next: (result) => {
        if (result.sonuc === 1) {
          this.notification.success(result.sunucuCevap || 'SCHOOL_BUS.MSG_AUTHORITY_ASSIGNED');
          this.loadAllAuthorityAssignments();
          this.authorityAssignForm.reset({ authorityId: null });
        } else {
          this.notification.error(result.sunucuCevap || 'SCHOOL_BUS.MSG_AUTHORITY_ASSIGN_ERROR');
        }
      },
      error: () => this.notification.error('SCHOOL_BUS.MSG_SERVER_ERROR'),
    });
  }

  protected confirmAuthorityAssignDelete(row: AuthorityAssignment): void {
    this.authorityAssignDeleting.set(row);
    this.authorityAssignDeleteVisible.set(true);
  }

  protected closeAuthorityAssignDelete(): void {
    this.authorityAssignDeleteVisible.set(false);
    this.authorityAssignDeleting.set(null);
  }

  protected deleteAuthorityAssign(): void {
    const target = this.authorityAssignDeleting();
    if (!target) return;

    this.busService.removeAuthorityAssignment(target.id).subscribe({
      next: (result) => {
        if (result.sonuc === 1) {
          this.notification.success(result.sunucuCevap || 'SCHOOL_BUS.MSG_RECORD_DELETED');
          this.loadAllAuthorityAssignments();
          this.closeAuthorityAssignDelete();
        } else {
          this.notification.error(result.sunucuCevap || 'SCHOOL_BUS.MSG_RECORD_DELETE_ERROR');
        }
      },
      error: () => this.notification.error('SCHOOL_BUS.MSG_SERVER_ERROR'),
    });
  }

  private loadServiceAuthorities(): void {
    this.serviceAuthoritiesLoading.set(true);
    this.busService
      .getServiceAuthorities()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.serviceAuthorities.set(rows);
          this.serviceAuthoritiesLoading.set(false);
        },
        error: () => {
          this.notification.error('SCHOOL_BUS.MSG_AUTHORITIES_ERROR');
          this.serviceAuthoritiesLoading.set(false);
        },
      });
  }

  protected confirmAuthoritySend(row: ServiceAuthority): void {
    this.authoritySendTarget.set(row);
    this.authoritySendVisible.set(true);
  }

  protected closeAuthoritySend(): void {
    if (this.authoritySendLoading()) return;
    this.authoritySendVisible.set(false);
    this.authoritySendTarget.set(null);
  }

  /** Giriş bilgilerini yeniden gönderir (mevcut giriş kaydı silinir, yenisi iletilir). */
  protected sendAuthorityLogin(): void {
    const target = this.authoritySendTarget();
    if (!target || this.authoritySendLoading()) return;

    this.authoritySendLoading.set(true);
    this.busService
      .sendAuthorityLogin(target.sicilId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.authoritySendLoading.set(false);
          if (res.sonuc === 1) {
            this.notification.success(res.sunucuCevap || 'SCHOOL_BUS.MSG_INFO_SENT');
          } else {
            this.notification.error(res.sunucuCevap || 'SCHOOL_BUS.MSG_INFO_SEND_ERROR');
          }
          this.authoritySendVisible.set(false);
          this.authoritySendTarget.set(null);
        },
        error: () => {
          this.authoritySendLoading.set(false);
          this.notification.error('SCHOOL_BUS.MSG_SERVER_ERROR');
        },
      });
  }

  protected setTab(tab: TabKey): void {
    this.activeTab.set(tab);
    if (tab === 'authorities') {
      this.loadServiceAuthorities();
    }
    if (tab === 'assignments') {
      this.loadAllAuthorityAssignments();
      if (this.authorities().length === 0) {
        this.loadAuthorities();
      }
    }
  }
}
