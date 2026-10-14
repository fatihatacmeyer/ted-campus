import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { PlansTabComponent } from './plans-tab';
import { BusStoreService } from '../../services/bus-store.service';
import { SchoolBusService } from '../../services/school-bus.service';
import { StudentBusPlan } from '../../models/school-bus.model';
import { provideAppTesting } from '../../../../testing/test-providers';

describe('PlansTabComponent', () => {
  let fixture: ComponentFixture<PlansTabComponent>;
  let component: PlansTabComponent;
  let busService: { getStudentBusPlans: ReturnType<typeof vi.fn> };

  const dialogs = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.p-dialog') as NodeListOf<HTMLElement>);

  beforeEach(async () => {
    busService = { getStudentBusPlans: vi.fn(() => of([] as StudentBusPlan[])) };
    const store = {
      buses: signal([]),
      students: signal([]),
      ensureBuses: vi.fn(),
      ensureStudents: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PlansTabComponent],
      providers: [
        ...provideAppTesting(),
        { provide: SchoolBusService, useValue: busService },
        { provide: BusStoreService, useValue: store },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlansTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('açılışta planları yükler', () => {
    expect(busService.getStudentBusPlans).toHaveBeenCalled();
  });

  it('plan formu p-dialog olarak açılır', async () => {
    component['openPlanForm']();
    fixture.detectChanges();
    await fixture.whenStable();

    await vi.waitFor(() => expect(dialogs()).toHaveLength(1));
    await vi.waitFor(() =>
      expect(fixture.nativeElement.querySelector('.p-dialog-close-button')).not.toBeNull(),
    );
  });

  it('kaydederken dialog kapatılamaz (kapat butonu kalkar, closePlanForm engellenir)', async () => {
    component['openPlanForm']();
    component['planSaving'].set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    await vi.waitFor(() =>
      expect(fixture.nativeElement.querySelector('.p-dialog-close-button')).toBeNull(),
    );

    component['closePlanForm']();
    expect(component['planFormVisible']()).toBe(true);
  });

  it('haftalık planda bitiş başlangıçtan önceyse tarih aralığı geçersiz sayılır', () => {
    component['planForm'].patchValue({
      repeatType: 'weekly',
      startDate: '2026-10-10',
      endDate: '2026-10-01',
    });
    expect(component['planDateRangeInvalid']()).toBe(true);

    component['planForm'].patchValue({ endDate: '2026-10-20' });
    expect(component['planDateRangeInvalid']()).toBe(false);
  });
});
