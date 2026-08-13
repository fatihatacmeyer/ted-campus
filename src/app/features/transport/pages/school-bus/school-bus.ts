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
import { Bus, BusAssignment, Passenger, SeferTuru, MOCK_ASSIGNMENTS } from './mock-data';
import {
  CustomizableTableComponent,
  ColumnCellDirective,
  ColumnDef,
} from '../../../../shared/components/customizable-table/customizable-table';
import { SchoolBusService } from '../../services/school-bus.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { BusDashboardStats } from '../../services/school-bus.service';

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
  protected readonly assignments = signal<BusAssignment[]>([]);

  // ── ID Counters ────────────────────────────────────────
  private busNextId = 100;
  private assignmentNextId = 100;

  // ── Dialog Visibility ──────────────────────────────────
  // Buses
  protected readonly busFormVisible = signal(false);
  protected readonly busDeleteVisible = signal(false);
  protected readonly busEditing = signal<Bus | null>(null);
  protected readonly busDeleting = signal<Bus | null>(null);

  // Assignments
  protected readonly assignmentFormVisible = signal(false);
  protected readonly assignmentDeleteVisible = signal(false);
  protected readonly assignmentDetailVisible = signal(false);
  protected readonly assignmentEditing = signal<BusAssignment | null>(null);
  protected readonly assignmentDeleting = signal<BusAssignment | null>(null);
  protected readonly assignmentDetail = signal<BusAssignment | null>(null);

  // ── Search Terms ───────────────────────────────────────
  protected assignmentSearchValue = '';
  protected readonly assignmentSearch = signal('');
  protected readonly seferTuruFilter = signal<SeferTuru | null>(null);

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

  protected readonly assignmentForm: FormGroup = this.fb.group({
    bus: [null, Validators.required],
    departureTime: ['07:30', Validators.required],
    tripType: ['Sabah', Validators.required],
  });

  // ── Dashboard Computed ─────────────────────────────────
  protected readonly totalBuses = computed(() => this.buses().length);
  protected readonly totalAssignments = computed(() => this.assignments().length);
  protected readonly totalPassengers = computed(() =>
    this.assignments().reduce((sum, a) => sum + a.passengers.length, 0),
  );
  protected readonly completedTrips = computed(
    () => this.assignments().filter((a) => a.status === 'Tamamlandı').length,
  );

  // ── Table Columns ──────────────────────────────────────
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

  protected readonly passengerColumns: ColumnDef<Passenger>[] = [
    { field: 'fullName', header: 'Ad Soyad', sortable: true },
    { field: 'className', header: 'Sınıf', sortable: true },
    { field: 'status', header: 'Durum', sortable: true },
  ];

  // ── Filtered Lists ─────────────────────────────────────
  protected readonly filteredAssignments = computed(() => {
    const term = this.assignmentSearch().toLowerCase();
    const tur = this.seferTuruFilter();
    return this.assignments().filter(
      (a) =>
        (a.bus.plate.toLowerCase().includes(term) ||
          a.bus.brand.toLowerCase().includes(term) ||
          a.bus.model.toLowerCase().includes(term) ||
          a.tripType.toLowerCase().includes(term) ||
          a.status.toLowerCase().includes(term)) &&
        (tur ? a.tripType === tur : true),
    );
  });

  // ── Dropdown Options ───────────────────────────────────
  protected readonly busOptions = computed(() =>
    this.buses().map((b) => ({
      label: `${b.plate} — ${b.brand} ${b.model}`,
      value: b,
    })),
  );

  protected readonly seferTuruOptions: { label: string; value: SeferTuru }[] = [
    { label: 'Sabah', value: 'Sabah' },
    { label: 'Öğleden Sonra', value: 'Öğleden Sonra' },
    { label: 'Akşam', value: 'Akşam' },
  ];

  protected readonly filteredAssignmentCount = computed(() => this.filteredAssignments().length);
  protected readonly sabahCount = computed(
    () => this.assignments().filter((a) => a.tripType === 'Sabah').length,
  );
  protected readonly ogledenSonraCount = computed(
    () => this.assignments().filter((a) => a.tripType === 'Öğleden Sonra').length,
  );
  protected readonly aksamCount = computed(
    () => this.assignments().filter((a) => a.tripType === 'Akşam').length,
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

        // Map mock assignments to actual database buses
        const mappedAssignments = MOCK_ASSIGNMENTS.map((assignment, index) => {
          const realBus = busesData[index % busesData.length] || assignment.bus;
          return {
            ...assignment,
            bus: realBus,
          };
        });
        this.assignments.set(mappedAssignments);
        if (mappedAssignments.length > 0) {
          this.assignmentNextId = Math.max(...mappedAssignments.map((a) => a.id)) + 1;
        }
      },
      error: (err) => {
        console.error('Failed to load buses from database:', err);
      },
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
  //  ASSIGNMENT CRUD
  // ════════════════════════════════════════════════════════

  protected readonly assignmentFormTitle = computed(() =>
    this.assignmentEditing() ? 'Atamayı Düzenle' : 'Yeni Atama Ekle',
  );

  openAssignmentForm(assignment?: BusAssignment): void {
    this.assignmentEditing.set(assignment ?? null);
    if (assignment) {
      this.assignmentForm.patchValue({
        bus: assignment.bus,
        departureTime: assignment.departureTime,
        tripType: assignment.tripType,
      });
    } else {
      this.assignmentForm.reset({ bus: null, departureTime: '07:30', tripType: 'Sabah' });
    }
    this.assignmentFormVisible.set(true);
  }

  protected closeAssignmentForm(): void {
    this.assignmentFormVisible.set(false);
    this.assignmentEditing.set(null);
    this.assignmentForm.reset();
  }

  submitAssignment(): void {
    if (this.assignmentForm.invalid) return;
    const v = this.assignmentForm.value;
    const editing = this.assignmentEditing();
    if (editing) {
      this.assignments.update((list) =>
        list.map((a) =>
          a.id === editing.id
            ? { ...a, bus: v.bus, departureTime: v.departureTime, tripType: v.tripType }
            : a,
        ),
      );
    } else {
      const newAssignment: BusAssignment = {
        id: this.assignmentNextId++,
        bus: v.bus,
        passengers: [],
        departureTime: v.departureTime,
        tripType: v.tripType,
        status: 'Beklemede',
      };
      this.assignments.update((list) => [...list, newAssignment]);
    }
    this.closeAssignmentForm();
  }

  protected openAssignmentDetail(assignment: BusAssignment): void {
    this.assignmentDetail.set(assignment);
    this.assignmentDetailVisible.set(true);
  }

  protected closeAssignmentDetail(): void {
    this.assignmentDetailVisible.set(true);
    this.assignmentDetailVisible.set(false);
    this.assignmentDetail.set(null);
  }

  protected confirmAssignmentDelete(assignment: BusAssignment): void {
    this.assignmentDeleting.set(assignment);
    this.assignmentDeleteVisible.set(true);
  }

  protected closeAssignmentDelete(): void {
    this.assignmentDeleteVisible.set(false);
    this.assignmentDeleting.set(null);
  }

  protected deleteAssignment(): void {
    const target = this.assignmentDeleting();
    if (!target) return;
    this.assignments.update((list) => list.filter((a) => a.id !== target.id));
    this.closeAssignmentDelete();
  }

  // ── Stat Detail Dialog ───────────────────────────────
  protected readonly statDetailVisible = signal(false);
  protected readonly statDetailType = signal<
    'buses' | 'activeBuses' | 'assignments' | 'passengers' | 'completedTrips' | null
  >(null);

  protected readonly statDetailTitle = computed(() => {
    const type = this.statDetailType();
    switch (type) {
      case 'buses':
        return 'Toplam Araç Listesi';
      case 'activeBuses':
        return 'Aktif Araç Listesi';
      case 'assignments':
        return 'Atama Listesi';
      case 'passengers':
        return 'Yolcu Listesi';
      case 'completedTrips':
        return 'Tamamlanan Seferler';
      default:
        return '';
    }
  });

  protected readonly statDetailItems = computed(() => {
    const type = this.statDetailType();
    if (!type) return [];
    switch (type) {
      case 'buses':
        return this.buses().map((b) => ({ label: `${b.brand} ${b.model}`, sub: b.plate }));
      case 'activeBuses':
        return this.buses()
          .filter((b) => b.status === 'Aktif')
          .map((b) => ({ label: `${b.brand} ${b.model}`, sub: b.plate }));
      case 'assignments':
        return this.assignments().map((a) => ({
          label: `${a.bus.brand} ${a.bus.model} (${a.bus.plate})`,
          sub: `${a.tripType} — ${a.status}`,
        }));
      case 'passengers':
        return this.assignments().flatMap((a) =>
          a.passengers.map((p) => ({ label: p.fullName, sub: `${p.className} — ${p.status}` })),
        );
      case 'completedTrips':
        return this.assignments()
          .filter((a) => a.status === 'Tamamlandı')
          .map((a) => ({
            label: `${a.bus.brand} ${a.bus.model} (${a.bus.plate})`,
            sub: a.departureTime,
          }));
      default:
        return [];
    }
  });

  openStatDetail(
    type: 'buses' | 'activeBuses' | 'assignments' | 'passengers' | 'completedTrips',
  ): void {
    this.statDetailType.set(type);
    this.statDetailVisible.set(true);
  }

  closeStatDetail(): void {
    this.statDetailVisible.set(false);
    this.statDetailType.set(null);
  }

  // ── Helpers ────────────────────────────────────────────
  protected getDurumSeverity(status: string): 'success' | 'warn' | 'info' {
    switch (status) {
      case 'Tamamlandı':
        return 'success';
      case 'Yolda':
        return 'warn';
      default:
        return 'info';
    }
  }

  protected getSeferTuruSeverity(tur: SeferTuru): 'info' | 'warn' | 'danger' {
    switch (tur) {
      case 'Sabah':
        return 'info';
      case 'Öğleden Sonra':
        return 'warn';
      case 'Akşam':
        return 'danger';
    }
  }

  protected toggleSeferTuruFilter(tur: SeferTuru): void {
    this.seferTuruFilter.set(this.seferTuruFilter() === tur ? null : tur);
  }

  protected getPassengerCount(a: BusAssignment): number {
    return a.passengers.length;
  }

  protected getBinmisCount(a: BusAssignment): number {
    return a.passengers.filter((p) => p.status === 'Binmiş').length;
  }

  protected getDoluOran(): number {
    return 0;
  }

  protected setTab(tab: TabKey): void {
    this.activeTab.set(tab);
  }
}
