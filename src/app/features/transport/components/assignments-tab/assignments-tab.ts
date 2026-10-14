import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { NotificationService } from '../../../../core/services/notification.service';
import {
  ColumnDef,
  CustomizableTableComponent,
} from '../../../../shared/components/customizable-table/customizable-table';
import {
  AuthorityAssignment,
  Bus,
  BusDirection,
  StudentAssignment,
} from '../../models/school-bus.model';
import { BusStoreService } from '../../services/bus-store.service';
import { SchoolBusService } from '../../services/school-bus.service';
import { boldText, injectI18nVersion } from '../../utils/transport.utils';

/** Atamalar sekmesi: araç kartları, araca öğrenci ve yetkili atama diyaloğu. */
@Component({
  selector: 'app-assignments-tab',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SelectModule,
    TagModule,
    TooltipModule,
    CustomizableTableComponent,
  ],
  templateUrl: './assignments-tab.html',
  styleUrl: './assignments-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentsTabComponent implements OnInit {
  private fb = inject(FormBuilder);
  private busService = inject(SchoolBusService);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);
  private store = inject(BusStoreService);
  private i18nVersion = injectI18nVersion();

  protected readonly assignmentBusSearch = signal('');
  protected assignmentBusSearchValue = '';

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

  protected readonly studentAssignForm: FormGroup = this.fb.group({
    studentId: [null, Validators.required],
    direction: [1, Validators.required],
  });

  protected readonly authorityAssignForm: FormGroup = this.fb.group({
    authorityId: [null, Validators.required],
  });

  protected readonly assignedStudentColumns: ColumnDef<StudentAssignment>[] = [
    { field: 'ogrenciAdSoyad', header: 'SCHOOL_BUS.COL_STUDENT', sortable: true },
    { field: 'sinif', header: 'SCHOOL_BUS.COL_CLASS', sortable: true },
    { field: 'kampus', header: 'SCHOOL_BUS.COL_CAMPUS', sortable: true },
  ];

  protected readonly authorityAssignmentsForBus = (servisId: number) =>
    this.allAuthorityAssignments().filter((a) => a.servisId === servisId);

  protected readonly filteredAssignmentBuses = computed(() => {
    const term = this.assignmentBusSearch().toLowerCase();
    const buses = this.store.buses();
    if (!term) return buses;
    return buses.filter(
      (b) =>
        b.plate.toLowerCase().includes(term) ||
        b.brand.toLowerCase().includes(term) ||
        b.model.toLowerCase().includes(term) ||
        (b.description || '').toLowerCase().includes(term),
    );
  });

  protected readonly studentOptions = computed(() =>
    this.store.students().map((s) => ({
      label: s.bolumad ? `${s.adsoyad} — ${s.bolumad}` : s.adsoyad,
      value: s.id,
    })),
  );

  protected readonly authorityOptions = computed(() =>
    this.store.authorities().map((y) => ({
      label: y.bolumad ? `${y.adsoyad} — ${y.bolumad}` : y.adsoyad,
      value: y.id,
    })),
  );

  protected readonly directionOptions = computed(() => {
    this.i18nVersion();
    return [
      { label: this.translate.instant('SCHOOL_BUS.DIRECTION_DEPARTURE'), value: 1 },
      { label: this.translate.instant('SCHOOL_BUS.DIRECTION_RETURN'), value: 2 },
      { label: this.translate.instant('SCHOOL_BUS.DIRECTION_BOTH'), value: 3 },
    ];
  });

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

  protected readonly bold = boldText;

  ngOnInit(): void {
    this.store.ensureBuses();
    this.store.ensureAuthorities();
    this.loadAllAuthorityAssignments();
  }

  protected directionText(direction: BusDirection): string {
    return this.translate.instant(
      direction === 1 ? 'SCHOOL_BUS.DIRECTION_DEPARTURE' : 'SCHOOL_BUS.DIRECTION_RETURN',
    );
  }

  protected checkAssignButtonDisabled(bus: Bus): boolean {
    if (this.studentAssignForm.invalid) return true;
    const direction = this.studentAssignForm.value.direction;

    if (direction === 1) return bus.bosKoltukGidis <= 0;
    if (direction === 2) return bus.bosKoltukDonus <= 0;
    if (direction === 3) return bus.bosKoltukGidis <= 0 || bus.bosKoltukDonus <= 0;

    return false;
  }

  protected openStudentAssign(bus: Bus): void {
    this.studentAssignBus.set(bus);
    this.studentAssignForm.reset({ studentId: null, direction: 1 });
    this.studentAssignDirectionTab.set(1);
    this.loadStudentAssignments(bus.id);

    this.store.ensureStudents();

    this.authorityAssignForm.reset({ authorityId: null });
    this.store.ensureAuthorities();

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
          this.store.loadBuses();
          this.studentAssignForm.reset({ studentId: null, direction: 1 });
        },
      });
    } else {
      this.busService.assignStudentToBus(v.studentId, bus.id, v.direction).subscribe({
        next: (result) => {
          if (result.sonuc === 1) {
            this.notification.success(result.sunucuCevap || 'SCHOOL_BUS.MSG_STUDENT_ASSIGNED');
            this.loadStudentAssignments(bus.id);
            this.store.loadBuses();
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
            this.store.loadBuses();
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
}
