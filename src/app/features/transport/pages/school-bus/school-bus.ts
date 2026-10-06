import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
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

import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  Bus,
  ServisYonu,
  StudentAssignment,
  BusDashboardStats,
  AuthorityAssignment,
  ServiceAuthority,
} from '../../models/school-bus.model';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

type TabKey = 'dashboard' | 'buses' | 'assignments' | 'authorities';

@Component({
  selector: 'app-school-bus',
  standalone: true,
  imports: [
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
  private destroyRef = inject(DestroyRef);

  protected readonly activeTab = signal<TabKey>('dashboard');
  protected readonly tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Genel Bakış', icon: 'dashboard' },
    { key: 'buses', label: 'Araçlar', icon: 'directions_bus' },
    { key: 'assignments', label: 'Atamalar', icon: 'assignment' },
    { key: 'authorities', label: 'Yetkililer', icon: 'admin_panel_settings' },
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
  protected readonly studentAssignDirectionTab = signal<ServisYonu>(1);

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
    ogrenciSicilId: [null, Validators.required],
    yon: [1, Validators.required],
  });

  protected readonly authorityAssignForm: FormGroup = this.fb.group({
    authoritySicilId: [null, Validators.required],
  });

  protected readonly busColumns: ColumnDef<Bus>[] = [
    { field: 'plate', header: 'Plaka', sortable: true },
    { field: 'brand', header: 'Marka', sortable: true },
    { field: 'model', header: 'Model', sortable: true },
    { field: 'seatCount', header: 'Koltuk Sayısı', sortable: true },
    { field: 'description', header: 'Açıklama', sortable: true },
    { field: 'status', header: 'Durum', sortable: true },
  ];

  protected readonly assignedStudentColumns: ColumnDef<StudentAssignment>[] = [
    { field: 'ogrenciAdSoyad', header: 'Öğrenci', sortable: true },
    { field: 'sinif', header: 'Sınıf', sortable: true },
    { field: 'kampus', header: 'Kampüs', sortable: true },
  ];

  protected readonly serviceAuthorityColumns: ColumnDef<ServiceAuthority>[] = [
    { field: 'adSoyad', header: 'Ad Soyad', sortable: true, alwaysVisible: true },
    { field: 'sicilNo', header: 'Sicil No', sortable: true },
    { field: 'cepTelefon', header: 'Telefon' },
    { field: 'email', header: 'E-posta', sortable: true },
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

  protected readonly yonOptions: { label: string; value: number }[] = [
    { label: 'Gidiş', value: 1 },
    { label: 'Dönüş', value: 2 },
    { label: 'Gidiş/Dönüş', value: 3 },
  ];

  protected checkAssignButtonDisabled(bus: Bus): boolean {
    if (this.studentAssignForm.invalid) return true;
    const yon = this.studentAssignForm.value.yon;

    if (yon === 1) return bus.bosKoltukGidis <= 0;
    if (yon === 2) return bus.bosKoltukDonus <= 0;
    if (yon === 3) return bus.bosKoltukGidis <= 0 || bus.bosKoltukDonus <= 0;

    return false;
  }

  protected readonly studentAssignGidisList = computed(() =>
    this.studentAssignments().filter((a) => a.yon === 1),
  );
  protected readonly studentAssignDonusList = computed(() =>
    this.studentAssignments().filter((a) => a.yon === 2),
  );
  protected readonly studentAssignGidisCount = computed(() => this.studentAssignGidisList().length);
  protected readonly studentAssignDonusCount = computed(() => this.studentAssignDonusList().length);
  protected readonly studentAssignActiveList = computed(() =>
    this.studentAssignDirectionTab() === 1
      ? this.studentAssignGidisList()
      : this.studentAssignDonusList(),
  );

  ngOnInit(): void {
    this.loadBuses();
    this.loadDashboardStats();
  }

  private loadDashboardStats(): void {
    this.busService.getDashboardStats().subscribe({
      next: (stats) => this.dashboardStats.set(stats),
      error: () => this.notification.error('Dashboard istatistikleri alınamadı.'),
    });
  }

  private loadBuses(): void {
    this.busService
      .getBuses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (busesData) => this.buses.set(busesData),
        error: () => this.notification.error('Araçlar yüklenemedi.'),
      });
  }

  private loadStudents(): void {
    this.personService.getPersonListCampus().subscribe({
      next: (people) => this.students.set(people.filter((p) => p.userdef === UserDef.Ogrenci)),
      error: () => this.notification.error('Öğrenci listesi alınamadı.'),
    });
  }

  private loadAuthorities(): void {
    this.personService.getPersonListCampus().subscribe({
      next: (people) => this.authorities.set(people.filter((p) => p.userdef === UserDef.Authority)),
      error: () => this.notification.error('Yetkili listesi alınamadı.'),
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
          this.notification.success(result.sunucuCevap || 'İşlem başarılı.');
          this.loadBuses();
          this.closeBusForm();
        } else {
          this.notification.error(result.sunucuCevap || 'İşlem sırasında hata oluştu.');
        }
      },
      error: () => this.notification.error('Sunucuyla iletişim kurulamadı.'),
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
          this.notification.success(result.sunucuCevap || 'Araç başarıyla silindi.');
          this.loadBuses();
          this.closeBusDelete();
        } else {
          this.notification.error(result.sunucuCevap || 'Araç silinirken hata oluştu.');
        }
      },
      error: () => this.notification.error('Sunucuyla iletişim kurulamadı.'),
    });
  }

  protected openStudentAssign(bus: Bus): void {
    this.studentAssignBus.set(bus);
    this.studentAssignForm.reset({ ogrenciSicilId: null, yon: 1 });
    this.studentAssignDirectionTab.set(1);
    this.loadStudentAssignments(bus.id);

    if (this.students().length === 0) this.loadStudents();

    this.authorityAssignForm.reset({ authoritySicilId: null });
    if (this.authorities().length === 0) this.loadAuthorities();

    this.studentAssignVisible.set(true);
  }

  protected setStudentAssignDirectionTab(yon: ServisYonu): void {
    this.studentAssignDirectionTab.set(yon);
  }

  protected closeStudentAssign(): void {
    this.studentAssignVisible.set(false);
    this.studentAssignBus.set(null);
    this.studentAssignments.set([]);
    this.studentAssignForm.reset({ ogrenciSicilId: null, yon: 1 });
    this.authorityAssignForm.reset({ authoritySicilId: null });
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
        this.notification.error('Öğrenci atamaları alınamadı.');
        this.studentAssignLoading.set(false);
      },
    });
  }

  submitStudentAssign(): void {
    if (this.studentAssignForm.invalid) return;
    const bus = this.studentAssignBus();
    if (!bus) return;
    const v = this.studentAssignForm.value;

    if (v.yon === 3) {
      this.studentAssignLoading.set(true);
      forkJoin([
        this.busService
          .assignStudentToBus(v.ogrenciSicilId, bus.id, 1 as ServisYonu)
          .pipe(catchError(() => of({ sonuc: -1, sunucuCevap: 'Gidiş atamasında hata oluştu.' }))),
        this.busService
          .assignStudentToBus(v.ogrenciSicilId, bus.id, 2 as ServisYonu)
          .pipe(catchError(() => of({ sonuc: -1, sunucuCevap: 'Dönüş atamasında hata oluştu.' }))),
      ]).subscribe({
        next: (results) => {
          const allSuccess = results.every((res) => res.sonuc === 1);
          if (allSuccess) {
            this.notification.success('Öğrenci hem gidiş hem dönüş için başarıyla atandı.');
          } else {
            this.notification.info('Atama yapıldı ancak yönlerin birinde hata oluşmuş olabilir.');
          }
          this.loadStudentAssignments(bus.id);
          this.loadBuses();
          this.studentAssignForm.reset({ ogrenciSicilId: null, yon: 1 });
        },
      });
    } else {
      this.busService.assignStudentToBus(v.ogrenciSicilId, bus.id, v.yon).subscribe({
        next: (result) => {
          if (result.sonuc === 1) {
            this.notification.success(result.sunucuCevap || 'Öğrenci servise başarıyla atandı.');
            this.loadStudentAssignments(bus.id);
            this.loadBuses();
            this.studentAssignForm.reset({ ogrenciSicilId: null, yon: v.yon });
          } else {
            this.notification.error(result.sunucuCevap || 'Öğrenci atanırken bir hata oluştu.');
          }
        },
        error: () => this.notification.error('Sunucuyla iletişim kurulurken bir hata oluştu.'),
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
          this.notification.success(result.sunucuCevap || 'Kayıt başarıyla silindi.');
          if (bus) {
            this.loadStudentAssignments(bus.id);
            this.loadBuses();
          }
          this.closeStudentAssignDelete();
        } else {
          this.notification.error(result.sunucuCevap || 'Kayıt silinirken hata oluştu.');
        }
      },
      error: () => this.notification.error('Sunucuyla iletişim kurulamadı.'),
    });
  }

  private loadAllAuthorityAssignments(): void {
    this.busService.getAuthorityAssignments().subscribe({
      next: (rows) => this.allAuthorityAssignments.set(rows),
      error: () => this.notification.error('Yetkili atamaları alınırken hata oluştu.'),
    });
  }

  submitAuthorityAssign(): void {
    if (this.authorityAssignForm.invalid) return;
    const bus = this.studentAssignBus();
    if (!bus) return;
    const v = this.authorityAssignForm.value;

    this.busService.assignAuthorityToBus(v.authoritySicilId, bus.id).subscribe({
      next: (result) => {
        if (result.sonuc === 1) {
          this.notification.success(result.sunucuCevap || 'Yetkili servise başarıyla atandı.');
          this.loadAllAuthorityAssignments();
          this.authorityAssignForm.reset({ authoritySicilId: null });
        } else {
          this.notification.error(result.sunucuCevap || 'Yetkili atanırken hata oluştu.');
        }
      },
      error: () => this.notification.error('Sunucuyla iletişim kurulamadı.'),
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
          this.notification.success(result.sunucuCevap || 'Kayıt başarıyla silindi.');
          this.loadAllAuthorityAssignments();
          this.closeAuthorityAssignDelete();
        } else {
          this.notification.error(result.sunucuCevap || 'Kayıt silinirken hata oluştu.');
        }
      },
      error: () => this.notification.error('Sunucuyla iletişim kurulamadı.'),
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
          this.notification.error('Yetkili listesi alınamadı.');
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
            this.notification.success(res.sunucuCevap || 'Bilgiler gönderildi.');
          } else {
            this.notification.error(res.sunucuCevap || 'Bilgiler gönderilemedi.');
          }
          this.authoritySendVisible.set(false);
          this.authoritySendTarget.set(null);
        },
        error: () => {
          this.authoritySendLoading.set(false);
          this.notification.error('Sunucuyla iletişim kurulamadı.');
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
