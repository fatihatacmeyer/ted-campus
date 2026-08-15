import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { Bus, ServisYonu, StudentAssignment } from './mock-data';
import {
  CustomizableTableComponent,
  ColumnCellDirective,
  ColumnDef,
} from '../../../../shared/components/customizable-table/customizable-table';
import { SchoolBusService } from '../../services/school-bus.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { BusDashboardStats } from '../../services/school-bus.service';
import { PersonService } from '../../../persons/services/person.service';
import { Person, UserDef } from '../../../../core/models/person.model';

type TabKey = 'dashboard' | 'buses' | 'assignments';

@Component({
  selector: 'app-school-bus',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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

  // ── Tab State ──────────────────────────────────────────
  protected readonly activeTab = signal<TabKey>('dashboard');
  protected readonly tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Genel Bakış', icon: 'dashboard' },
    { key: 'buses', label: 'Araçlar', icon: 'directions_bus' },
    { key: 'assignments', label: 'Atamalar', icon: 'assignment' },
  ];

  // ── Data State ─────────────────────────────────────────
  protected readonly buses = signal<Bus[]>([]);
  protected readonly students = signal<Person[]>([]);

  // ── ID Counters ────────────────────────────────────────
  private busNextId = 100;

  // ── Dialog Visibility: Buses ────────────────────────────
  protected readonly busFormVisible = signal(false);
  protected readonly busDeleteVisible = signal(false);
  protected readonly busEditing = signal<Bus | null>(null);
  protected readonly busDeleting = signal<Bus | null>(null);

  // ── Dialog Visibility: Öğrenci Atama (araca bağlı) ──────
  protected readonly studentAssignVisible = signal(false);
  protected readonly studentAssignBus = signal<Bus | null>(null);
  protected readonly studentAssignments = signal<StudentAssignment[]>([]);
  protected readonly studentAssignLoading = signal(false);
  protected readonly studentAssignDeleteVisible = signal(false);
  protected readonly studentAssignDeleting = signal<StudentAssignment | null>(null);
  protected readonly studentAssignDirectionTab = signal<ServisYonu>(1);

  // ── Search Terms ───────────────────────────────────────
  protected assignmentBusSearchValue = '';
  protected readonly assignmentBusSearch = signal('');

  protected readonly dashboardStats = signal<BusDashboardStats | null>(null);

  // ── Forms ──────────────────────────────────────────────
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

  // ── Dashboard Computed ─────────────────────────────────
  protected readonly totalBuses = computed(() => this.buses().length);

  // ── Table Columns: Araçlar ──────────────────────────────
  protected readonly busColumns: ColumnDef<Bus>[] = [
    { field: 'plate', header: 'Plaka', sortable: true },
    { field: 'brand', header: 'Marka', sortable: true },
    { field: 'model', header: 'Model', sortable: true },
    { field: 'seatCount', header: 'Koltuk Sayısı', sortable: true },
    { field: 'occupiedSeats', header: 'Dolu Koltuk', sortable: true },
    { field: 'emptySeats', header: 'Boş Koltuk', sortable: true },
    { field: 'description', header: 'Açıklama', sortable: true },
    { field: 'status', header: 'Durum', sortable: true },
  ];

  // ── Table Columns: Bir araca atanmış öğrenciler (Gidiş / Dönüş ayrı ayrı) ──
  protected readonly assignedStudentColumns: ColumnDef<StudentAssignment>[] = [
    { field: 'ogrenciAdSoyad', header: 'Öğrenci', sortable: true },
    { field: 'sinif', header: 'Sınıf', sortable: true },
    { field: 'kampus', header: 'Kampüs', sortable: true },
  ];

  // ── Filtered Lists ─────────────────────────────────────
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

  // ── Dropdown Options ───────────────────────────────────
  protected readonly studentOptions = computed(() =>
    this.students().map((s) => ({
      label: s.bolumad ? `${s.adsoyad} — ${s.bolumad}` : s.adsoyad,
      value: s.id,
    })),
  );

  protected readonly yonOptions: { label: string; value: ServisYonu }[] = [
    { label: 'Gidiş', value: 1 },
    { label: 'Dönüş', value: 2 },
  ];

  // İki ayrı liste: Gidiş (Yön=1) ve Dönüş (Yön=2)
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
      error: (err) => console.error('Dashboard istatistikleri alınamadı:', err),
    });
  }

  private loadBuses(): void {
    this.busService.getBuses().subscribe({
      next: (busesData) => {
        this.buses.set(busesData);
        if (busesData.length > 0) {
          this.busNextId = Math.max(...busesData.map((b) => b.id)) + 1;
        }
      },
      error: (err) => {
        console.error('Failed to load buses from database:', err);
      },
    });
  }

  private loadStudents(): void {
    this.personService.getPersonListCampus().subscribe({
      next: (people) => this.students.set(people.filter((p) => p.userdef === UserDef.Ogrenci)),
      error: (err) => console.error('Öğrenci listesi alınamadı:', err),
    });
  }

  // ════════════════════════════════════════════════════════
  //  BUS CRUD
  // ════════════════════════════════════════════════════════

  openBusForm(bus?: Bus): void {
    this.busEditing.set(bus ?? null);
    if (bus) {
      this.busForm.patchValue({
        plate: bus.plate,
        brand: bus.brand,
        model: bus.model,
        seatCount: bus.seatCount,
        description: bus.description,
        status: bus.status,
      });
    } else {
      this.busForm.reset({
        plate: '',
        brand: '',
        model: '',
        seatCount: 16,
        description: '',
        status: 'Aktif',
      });
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

    if (editing) {
      // DÜZENLEME İŞLEMİ (UPDATE)
      this.busService.updateBus(editing.id, v).subscribe({
        next: (result) => {
          if (result.sonuc === 1) {
            this.notification.success(result.sunucuCevap || 'Araç başarıyla güncellendi.');
            this.loadBuses(); // Tabloyu sunucudan güncel verilerle yenile
            this.closeBusForm();
          } else {
            this.notification.error(result.sunucuCevap || 'Araç güncellenirken bir hata oluştu.');
          }
        },
        error: (err) => {
          this.notification.error('Sunucuyla iletişim kurulurken bir hata oluştu.');
          console.error(err);
        },
      });
    } else {
      // EKLEME İŞLEMİ (INSERT) - Mevcut haliyle kalıyor
      this.busService.addBus(v).subscribe({
        next: (result) => {
          if (result.sonuc === 1) {
            this.notification.success(result.sunucuCevap || 'Araç başarıyla eklendi.');
            this.loadBuses();
            this.closeBusForm();
          } else {
            this.notification.error(result.sunucuCevap || 'Araç eklenirken bir hata oluştu.');
          }
        },
        error: (err) => {
          this.notification.error('Sunucuyla iletişim kurulurken bir hata oluştu.');
          console.error(err);
        },
      });
    }
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

    // SİLME İŞLEMİ (DELETE)
    this.busService.deleteBus(target.id).subscribe({
      next: (result) => {
        if (result.sonuc === 1) {
          this.notification.success(result.sunucuCevap || 'Araç başarıyla silindi.');
          this.loadBuses(); // Tabloyu yenile
          this.closeBusDelete();
        } else {
          this.notification.error(result.sunucuCevap || 'Araç silinirken bir hata oluştu.');
        }
      },
      error: (err) => {
        this.notification.error('Sunucuyla iletişim kurulurken bir hata oluştu.');
        console.error(err);
        this.closeBusDelete();
      },
    });
  }

  // ════════════════════════════════════════════════════════
  //  ÖĞRENCİ SERVİS ATAMASI (araca bağlı)
  // ════════════════════════════════════════════════════════

  protected openStudentAssign(bus: Bus): void {
    this.studentAssignBus.set(bus);
    this.studentAssignForm.reset({ ogrenciSicilId: null, yon: 1 });
    this.studentAssignDirectionTab.set(1);
    this.loadStudentAssignments(bus.id);
    if (this.students().length === 0) {
      this.loadStudents();
    }
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
  }

  private loadStudentAssignments(servisId: number): void {
    this.studentAssignLoading.set(true);
    this.busService.getStudentAssignments({ servisId }).subscribe({
      next: (rows) => {
        this.studentAssignments.set(rows);
        this.studentAssignLoading.set(false);
      },
      error: (err) => {
        this.notification.error('Öğrenci atamaları alınırken bir hata oluştu.');
        console.error(err);
        this.studentAssignLoading.set(false);
      },
    });
  }

  submitStudentAssign(): void {
    if (this.studentAssignForm.invalid) return;
    const bus = this.studentAssignBus();
    if (!bus) return;
    const v = this.studentAssignForm.value;

    this.busService.assignStudentToBus(v.ogrenciSicilId, bus.id, v.yon).subscribe({
      next: (result) => {
        if (result.sonuc === 1) {
          this.notification.success(result.sunucuCevap || 'Öğrenci servise başarıyla atandı.');
          this.loadStudentAssignments(bus.id);
          this.loadBuses(); // dolu/boş koltuk sayıları güncellensin
          this.studentAssignForm.reset({ ogrenciSicilId: null, yon: v.yon });
        } else {
          this.notification.error(result.sunucuCevap || 'Öğrenci atanırken bir hata oluştu.');
        }
      },
      error: (err) => {
        this.notification.error('Sunucuyla iletişim kurulurken bir hata oluştu.');
        console.error(err);
      },
    });
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
          this.notification.error(result.sunucuCevap || 'Kayıt silinirken bir hata oluştu.');
        }
      },
      error: (err) => {
        this.notification.error('Sunucuyla iletişim kurulurken bir hata oluştu.');
        console.error(err);
        this.closeStudentAssignDelete();
      },
    });
  }

  // ── Helpers ────────────────────────────────────────────
  protected setTab(tab: TabKey): void {
    this.activeTab.set(tab);
  }
}
