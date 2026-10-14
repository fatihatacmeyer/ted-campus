import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AssignmentsTabComponent } from './assignments-tab';
import { Bus, StudentAssignment } from '../../models/school-bus.model';
import { BusStoreService } from '../../services/bus-store.service';
import { SchoolBusService } from '../../services/school-bus.service';
import { provideAppTesting } from '../../../../testing/test-providers';

describe('AssignmentsTabComponent', () => {
  let fixture: ComponentFixture<AssignmentsTabComponent>;
  let component: AssignmentsTabComponent;
  let store: {
    buses: ReturnType<typeof signal<Bus[]>>;
    students: ReturnType<typeof signal<never[]>>;
    authorities: ReturnType<typeof signal<never[]>>;
    ensureBuses: ReturnType<typeof vi.fn>;
    ensureStudents: ReturnType<typeof vi.fn>;
    ensureAuthorities: ReturnType<typeof vi.fn>;
    loadBuses: ReturnType<typeof vi.fn>;
  };

  const bus = (overrides: Partial<Bus> = {}): Bus =>
    ({
      id: 7,
      plate: '34 ABC 123',
      brand: 'Mercedes',
      model: 'Sprinter',
      seatCount: 16,
      description: '',
      status: 'Aktif',
      bosKoltukGidis: 3,
      bosKoltukDonus: 3,
      doluKoltukGidis: 13,
      doluKoltukDonus: 13,
      ...overrides,
    }) as Bus;

  const dialogs = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.p-dialog') as NodeListOf<HTMLElement>);

  beforeEach(async () => {
    store = {
      buses: signal([bus(), bus({ id: 8, plate: '06 XYZ 999', brand: 'Ford', model: 'Transit' })]),
      students: signal([]),
      authorities: signal([]),
      ensureBuses: vi.fn(),
      ensureStudents: vi.fn(),
      ensureAuthorities: vi.fn(),
      loadBuses: vi.fn(),
    };
    const busService = {
      getAuthorityAssignments: vi.fn(() => of([])),
      getStudentAssignments: vi.fn(() => of([] as StudentAssignment[])),
    };

    await TestBed.configureTestingModule({
      imports: [AssignmentsTabComponent],
      providers: [
        ...provideAppTesting(),
        { provide: SchoolBusService, useValue: busService },
        { provide: BusStoreService, useValue: store },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AssignmentsTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('her araç için bir kart gösterir', () => {
    expect(fixture.nativeElement.querySelectorAll('.bus-card')).toHaveLength(2);
  });

  it('arama kutusu araç kartlarını süzer', () => {
    component['assignmentBusSearch'].set('ford');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.bus-card')).toHaveLength(1);
  });

  it('atama dialogu açılır, üstüne silme onayı ikinci dialog olarak biner', async () => {
    component['openStudentAssign'](bus());
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(dialogs()).toHaveLength(1));
    expect(store.ensureStudents).toHaveBeenCalled();

    component['confirmStudentAssignDelete']({
      id: 1,
      ogrenciAdSoyad: 'Ali Veli',
    } as StudentAssignment);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(dialogs()).toHaveLength(2));

    component['closeStudentAssignDelete']();
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(dialogs()).toHaveLength(1));
  });

  it('dolu araca atama butonu kapalıdır', () => {
    component['studentAssignForm'].patchValue({ studentId: 5, direction: 1 });
    expect(component['checkAssignButtonDisabled'](bus({ bosKoltukGidis: 0 }))).toBe(true);
    expect(component['checkAssignButtonDisabled'](bus({ bosKoltukGidis: 2 }))).toBe(false);
  });
});
