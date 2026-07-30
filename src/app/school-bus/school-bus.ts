import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import {
  Bus,
  BusAssignment,
  Driver,
  Hostess,
  SeferTuru,
  MOCK_ASSIGNMENTS,
  MOCK_BUSES,
  MOCK_DRIVERS,
  MOCK_HOSTESSES,
} from './mock-data';

type TabKey = 'dashboard' | 'buses' | 'drivers' | 'hostesses' | 'assignments';

@Component({
  selector: 'app-school-bus',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardModule,
    TableModule,
    TagModule,
    ButtonModule,
    TooltipModule,
    SelectModule,
    InputTextModule,
    TextareaModule,
  ],
  templateUrl: './school-bus.html',
  styleUrl: './school-bus.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchoolBusComponent {
  private fb = inject(FormBuilder);

  // ── Tab State ──────────────────────────────────────────
  protected readonly activeTab = signal<TabKey>('dashboard');
  protected readonly tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Genel Bakış', icon: 'dashboard' },
    { key: 'buses', label: 'Araçlar', icon: 'directions_bus' },
    { key: 'drivers', label: 'Şöförler', icon: 'person' },
    { key: 'hostesses', label: 'Hostesler', icon: 'badge' },
    { key: 'assignments', label: 'Atamalar', icon: 'assignment' },
  ];

  // ── Data State ─────────────────────────────────────────
  protected readonly buses = signal<Bus[]>([...MOCK_BUSES]);
  protected readonly drivers = signal<Driver[]>([...MOCK_DRIVERS]);
  protected readonly hostesses = signal<Hostess[]>([...MOCK_HOSTESSES]);
  protected readonly assignments = signal<BusAssignment[]>([...MOCK_ASSIGNMENTS]);

  // ── ID Counters ────────────────────────────────────────
  private busNextId = MOCK_BUSES.length + 1;
  private driverNextId = MOCK_DRIVERS.length + 1;
  private hostessNextId = MOCK_HOSTESSES.length + 1;
  private assignmentNextId = MOCK_ASSIGNMENTS.length + 1;

  // ── Dialog Visibility ──────────────────────────────────
  // Buses
  protected readonly busFormVisible = signal(false);
  protected readonly busDeleteVisible = signal(false);
  protected readonly busEditing = signal<Bus | null>(null);
  protected readonly busDeleting = signal<Bus | null>(null);

  // Drivers
  protected readonly driverFormVisible = signal(false);
  protected readonly driverDeleteVisible = signal(false);
  protected readonly driverEditing = signal<Driver | null>(null);
  protected readonly driverDeleting = signal<Driver | null>(null);

  // Hostesses
  protected readonly hostessFormVisible = signal(false);
  protected readonly hostessDeleteVisible = signal(false);
  protected readonly hostessEditing = signal<Hostess | null>(null);
  protected readonly hostessDeleting = signal<Hostess | null>(null);

  // Assignments
  protected readonly assignmentFormVisible = signal(false);
  protected readonly assignmentDeleteVisible = signal(false);
  protected readonly assignmentDetailVisible = signal(false);
  protected readonly assignmentEditing = signal<BusAssignment | null>(null);
  protected readonly assignmentDeleting = signal<BusAssignment | null>(null);
  protected readonly assignmentDetail = signal<BusAssignment | null>(null);

  // ── Search Terms ───────────────────────────────────────
  protected busSearchValue = '';
  protected driverSearchValue = '';
  protected hostessSearchValue = '';
  protected assignmentSearchValue = '';
  protected readonly busSearch = signal('');
  protected readonly driverSearch = signal('');
  protected readonly hostessSearch = signal('');
  protected readonly assignmentSearch = signal('');
  protected readonly seferTuruFilter = signal<SeferTuru | null>(null);

  // ── Forms ──────────────────────────────────────────────
  protected readonly busForm: FormGroup = this.fb.group({
    adi: ['', Validators.required],
    plaka: ['', Validators.required],
  });

  protected readonly driverForm: FormGroup = this.fb.group({
    adSoyad: ['', Validators.required],
    telefon: ['', Validators.required],
  });

  protected readonly hostessForm: FormGroup = this.fb.group({
    adSoyad: ['', Validators.required],
    telefon: ['', Validators.required],
  });

  protected readonly assignmentForm: FormGroup = this.fb.group({
    bus: [null, Validators.required],
    sofor: [null, Validators.required],
    hostes: [null],
    kalkisSaati: ['07:30', Validators.required],
    seferTuru: ['Sabah', Validators.required],
  });

  // ── Dashboard Computed ─────────────────────────────────
  protected readonly totalBuses = computed(() => this.buses().length);
  protected readonly totalDrivers = computed(() => this.drivers().length);
  protected readonly totalHostesses = computed(() => this.hostesses().length);
  protected readonly totalAssignments = computed(() => this.assignments().length);
  protected readonly totalPassengers = computed(() =>
    this.assignments().reduce((sum, a) => sum + a.yolcular.length, 0),
  );
  protected readonly completedTrips = computed(() =>
    this.assignments().filter(a => a.durum === 'Tamamlandı').length,
  );

  // ── Filtered Lists ─────────────────────────────────────
  protected readonly filteredBuses = computed(() => {
    const term = this.busSearch().toLowerCase();
    return this.buses().filter(b =>
      b.adi.toLowerCase().includes(term) ||
      b.plaka.toLowerCase().includes(term)
    );
  });

  protected readonly filteredDrivers = computed(() => {
    const q = this.driverSearch().toLowerCase();
    return q ? this.drivers().filter(d =>
      d.adSoyad.toLowerCase().includes(q) ||
      d.telefon.toLowerCase().includes(q)
    ) : this.drivers();
  });

  protected readonly filteredHostesses = computed(() => {
    const q = this.hostessSearch().toLowerCase();
    return q ? this.hostesses().filter(h =>
      h.adSoyad.toLowerCase().includes(q) ||
      h.telefon.toLowerCase().includes(q)
    ) : this.hostesses();
  });

  protected readonly filteredAssignments = computed(() => {
    const term = this.assignmentSearch().toLowerCase();
    const tur = this.seferTuruFilter();
    return this.assignments().filter(a =>
      (a.bus.plaka.toLowerCase().includes(term) ||
       a.bus.adi.toLowerCase().includes(term) ||
       a.sofor.adSoyad.toLowerCase().includes(term) ||
       a.seferTuru.toLowerCase().includes(term) ||
       a.durum.toLowerCase().includes(term)) &&
      (tur ? a.seferTuru === tur : true)
    );
  });

  // ── Dropdown Options ───────────────────────────────────
  protected readonly busOptions = computed(() =>
    this.buses().map(b => ({
      label: b.adi,
      value: b,
    }))
  );

  protected readonly driverOptions = computed(() =>
    this.drivers().map(d => ({
      label: `${d.adSoyad} — ${d.telefon}`,
      value: d.id,
    })),
  );

  protected readonly hostessOptions = computed(() =>
    this.hostesses().map(h => ({
      label: `${h.adSoyad} — ${h.telefon}`,
      value: h.id,
    })),
  );

  protected readonly seferTuruOptions: { label: string; value: SeferTuru }[] = [
    { label: 'Sabah', value: 'Sabah' },
    { label: 'Öğleden Sonra', value: 'Öğleden Sonra' },
    { label: 'Akşam', value: 'Akşam' },
  ];

  protected readonly filteredAssignmentCount = computed(() => this.filteredAssignments().length);
  protected readonly sabahCount = computed(() => this.assignments().filter(a => a.seferTuru === 'Sabah').length);
  protected readonly ogledenSonraCount = computed(() => this.assignments().filter(a => a.seferTuru === 'Öğleden Sonra').length);
  protected readonly aksamCount = computed(() => this.assignments().filter(a => a.seferTuru === 'Akşam').length);

  // ════════════════════════════════════════════════════════
  //  BUS CRUD
  // ════════════════════════════════════════════════════════

  openBusForm(bus?: Bus): void {
    this.busEditing.set(bus ?? null);
    if (bus) {
      this.busForm.patchValue({
        adi: bus.adi,
        plaka: bus.plaka,
      });
    } else {
      this.busForm.reset({ plaka: '', adi: '' });
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
      this.buses.update(list =>
        list.map(b => b.id === editing.id ? { ...b, ...v } : b)
      );
    } else {
      const newBus: Bus = {
        id: this.busNextId++,
        adi: v.adi,
        plaka: v.plaka,
      };
      this.buses.update(list => [...list, newBus]);
    }
    this.closeBusForm();
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
    this.buses.update(list => list.filter(b => b.id !== target.id));
    const idx = MOCK_BUSES.findIndex(b => b.id === target.id);
    if (idx !== -1) MOCK_BUSES.splice(idx, 1);
    this.closeBusDelete();
  }

  // ════════════════════════════════════════════════════════
  //  DRIVER CRUD
  // ════════════════════════════════════════════════════════

  openDriverForm(driver?: Driver): void {
    this.driverEditing.set(driver ?? null);
    if (driver) {
      this.driverForm.patchValue({ adSoyad: driver.adSoyad, telefon: driver.telefon });
    } else {
      this.driverForm.reset({ adSoyad: '', telefon: '' });
    }
    this.driverFormVisible.set(true);
  }

  protected closeDriverForm(): void {
    this.driverFormVisible.set(false);
    this.driverEditing.set(null);
    this.driverForm.reset();
  }

  submitDriver(): void {
    if (this.driverForm.invalid) return;
    const v = this.driverForm.value;
    const editing = this.driverEditing();
    if (editing) {
      this.drivers.update(list =>
        list.map(d => d.id === editing.id ? { ...d, ...v } : d)
      );
    } else {
      const newDriver: Driver = {
        id: this.driverNextId++,
        adSoyad: v.adSoyad,
        telefon: v.telefon,
      };
      this.drivers.update(list => [...list, newDriver]);
    }
    this.closeDriverForm();
  }

  protected confirmDriverDelete(driver: Driver): void {
    this.driverDeleting.set(driver);
    this.driverDeleteVisible.set(true);
  }

  protected closeDriverDelete(): void {
    this.driverDeleteVisible.set(false);
    this.driverDeleting.set(null);
  }

  protected deleteDriver(): void {
    const target = this.driverDeleting();
    if (!target) return;
    this.drivers.update(list => list.filter(d => d.id !== target.id));
    const idx = MOCK_DRIVERS.findIndex(d => d.id === target.id);
    if (idx !== -1) MOCK_DRIVERS.splice(idx, 1);
    this.closeDriverDelete();
  }

  // ════════════════════════════════════════════════════════
  //  HOSTESS CRUD
  // ════════════════════════════════════════════════════════

  protected openHostessForm(hostess?: Hostess): void {
    if (hostess) {
      this.hostessEditing.set(hostess);
      this.hostessForm.patchValue({
        adSoyad: hostess.adSoyad,
        telefon: hostess.telefon,
      });
    } else {
      this.hostessEditing.set(null);
      this.hostessForm.reset({ adSoyad: '', telefon: '' });
    }
    this.hostessFormVisible.set(true);
  }

  protected closeHostessForm(): void {
    this.hostessFormVisible.set(false);
    this.hostessEditing.set(null);
    this.hostessForm.reset();
  }

  protected submitHostess(): void {
    if (this.hostessForm.invalid) { this.hostessForm.markAllAsTouched(); return; }
    const v = this.hostessForm.value;
    const editing = this.hostessEditing();

    if (editing) {
      const updated: Hostess = { ...editing, adSoyad: v.adSoyad, telefon: v.telefon };
      this.hostesses.update(list => list.map(h => h.id === editing.id ? updated : h));
      const idx = MOCK_HOSTESSES.findIndex(h => h.id === editing.id);
      if (idx !== -1) MOCK_HOSTESSES[idx] = updated;
    } else {
      const newHostess: Hostess = { id: this.hostessNextId++, adSoyad: v.adSoyad, telefon: v.telefon };
      this.hostesses.update(list => [...list, newHostess]);
      MOCK_HOSTESSES.push(newHostess);
    }
    this.closeHostessForm();
  }

  protected confirmHostessDelete(hostess: Hostess): void {
    this.hostessDeleting.set(hostess);
    this.hostessDeleteVisible.set(true);
  }

  protected closeHostessDelete(): void {
    this.hostessDeleteVisible.set(false);
    this.hostessDeleting.set(null);
  }

  protected deleteHostess(): void {
    const target = this.hostessDeleting();
    if (!target) return;
    this.hostesses.update(list => list.filter(h => h.id !== target.id));
    const idx = MOCK_HOSTESSES.findIndex(h => h.id === target.id);
    if (idx !== -1) MOCK_HOSTESSES.splice(idx, 1);
    this.closeHostessDelete();
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
        sofor: assignment.sofor,
        hostes: assignment.hostes ?? null,
        kalkisSaati: assignment.kalkisSaati,
        seferTuru: assignment.seferTuru,
      });
    } else {
      this.assignmentForm.reset({ bus: null, sofor: null, hostes: null, kalkisSaati: '07:30', seferTuru: 'Sabah' });
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
      this.assignments.update(list =>
        list.map(a => a.id === editing.id ? { ...a, bus: v.bus, sofor: v.sofor, hostes: v.hostes, kalkisSaati: v.kalkisSaati, seferTuru: v.seferTuru } : a)
      );
    } else {
      const newAssignment: BusAssignment = {
        id: this.assignmentNextId++,
        bus: v.bus,
        sofor: v.sofor,
        hostes: v.hostes,
        yolcular: [],
        kalkisSaati: v.kalkisSaati,
        seferTuru: v.seferTuru,
        durum: 'Beklemede',
      };
      this.assignments.update(list => [...list, newAssignment]);
    }
    this.closeAssignmentForm();
  }

  protected openAssignmentDetail(assignment: BusAssignment): void {
    this.assignmentDetail.set(assignment);
    this.assignmentDetailVisible.set(true);
  }

  protected closeAssignmentDetail(): void {
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
    this.assignments.update(list => list.filter(a => a.id !== target.id));
    const idx = MOCK_ASSIGNMENTS.findIndex(a => a.id === target.id);
    if (idx !== -1) MOCK_ASSIGNMENTS.splice(idx, 1);
    this.closeAssignmentDelete();
  }

  // ── Stat Detail Dialog ───────────────────────────────
  protected readonly statDetailVisible = signal(false);
  protected readonly statDetailType = signal<'buses' | 'activeBuses' | 'drivers' | 'hostesses' | 'assignments' | 'passengers' | 'completedTrips' | null>(null);

  protected readonly statDetailTitle = computed(() => {
    const type = this.statDetailType();
    switch (type) {
      case 'buses': return 'Toplam Araç Listesi';
      case 'activeBuses': return 'Aktif Araç Listesi';
      case 'drivers': return 'Şöför Listesi';
      case 'hostesses': return 'Hostes Listesi';
      case 'assignments': return 'Atama Listesi';
      case 'passengers': return 'Yolcu Listesi';
      case 'completedTrips': return 'Tamamlanan Seferler';
      default: return '';
    }
  });

  protected readonly statDetailItems = computed(() => {
    const type = this.statDetailType();
    if (!type) return [];
    switch (type) {
      case 'buses': return this.buses().map(b => ({ label: b.adi, sub: b.plaka }));
      case 'activeBuses': return this.buses().map(b => ({ label: b.adi, sub: b.plaka }));
      case 'drivers': return this.drivers().map(d => ({ label: d.adSoyad, sub: d.telefon }));
      case 'hostesses': return this.hostesses().map(h => ({ label: h.adSoyad, sub: h.telefon }));
      case 'assignments': return this.assignments().map(a => ({ label: a.bus.adi, sub: `${a.sofor.adSoyad} — ${a.seferTuru} — ${a.durum}` }));
      case 'passengers': return this.assignments().flatMap(a => a.yolcular.map(p => ({ label: p.adSoyad, sub: `${p.sinif} — ${p.durum}` })));
      case 'completedTrips': return this.assignments().filter(a => a.durum === 'Tamamlandı').map(a => ({ label: a.bus.adi, sub: `${a.sofor.adSoyad} — ${a.kalkisSaati}` }));
      default: return [];
    }
  });

  openStatDetail(type: 'buses' | 'activeBuses' | 'drivers' | 'hostesses' | 'assignments' | 'passengers' | 'completedTrips'): void {
    this.statDetailType.set(type);
    this.statDetailVisible.set(true);
  }

  closeStatDetail(): void {
    this.statDetailVisible.set(false);
    this.statDetailType.set(null);
  }

  // ── Helpers ────────────────────────────────────────────
  protected getDurumSeverity(durum: string): 'success' | 'warn' | 'info' {
    switch (durum) {
      case 'Tamamlandı': return 'success';
      case 'Yolda': return 'warn';
      default: return 'info';
    }
  }

  protected getSeferTuruSeverity(tur: SeferTuru): 'info' | 'warn' | 'danger' {
    switch (tur) {
      case 'Sabah': return 'info';
      case 'Öğleden Sonra': return 'warn';
      case 'Akşam': return 'danger';
    }
  }

  protected toggleSeferTuruFilter(tur: SeferTuru): void {
    this.seferTuruFilter.set(this.seferTuruFilter() === tur ? null : tur);
  }

  protected getPassengerCount(a: BusAssignment): number {
    return a.yolcular.length;
  }

  protected getBinmisCount(a: BusAssignment): number {
    return a.yolcular.filter(y => y.durum === 'Binmiş').length;
  }

  protected getDoluOran(a: BusAssignment): number {
    return 0;
  }

  protected setTab(tab: TabKey): void {
    this.activeTab.set(tab);
  }
}
