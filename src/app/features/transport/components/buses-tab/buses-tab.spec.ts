import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { BusesTabComponent } from './buses-tab';
import { Bus } from '../../models/school-bus.model';
import { BusStoreService } from '../../services/bus-store.service';
import { SchoolBusService } from '../../services/school-bus.service';
import { provideAppTesting } from '../../../../testing/test-providers';

describe('BusesTabComponent', () => {
  let fixture: ComponentFixture<BusesTabComponent>;
  let component: BusesTabComponent;
  let busService: { addBus: ReturnType<typeof vi.fn>; deleteBus: ReturnType<typeof vi.fn> };
  let store: {
    buses: ReturnType<typeof signal<Bus[]>>;
    ensureBuses: () => void;
    loadBuses: () => void;
  };

  const bus = (overrides: Partial<Bus> = {}): Bus =>
    ({
      id: 1,
      plate: '34 ABC 123',
      brand: 'Mercedes',
      model: 'Sprinter',
      seatCount: 16,
      description: '',
      status: 'Aktif',
      ...overrides,
    }) as Bus;

  const dialogs = (): HTMLElement[] =>
    Array.from(document.querySelectorAll<HTMLElement>('.p-dialog'));

  beforeEach(async () => {
    busService = {
      addBus: vi.fn(() => of({ sonuc: 1, sunucuCevap: 'ok' })),
      deleteBus: vi.fn(() => of({ sonuc: 1, sunucuCevap: 'ok' })),
    };
    store = {
      buses: signal([bus()]),
      ensureBuses: vi.fn(),
      loadBuses: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [BusesTabComponent],
      providers: [
        ...provideAppTesting(),
        { provide: SchoolBusService, useValue: busService },
        { provide: BusStoreService, useValue: store },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BusesTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('açılışta araçları yükler', () => {
    expect(store.ensureBuses).toHaveBeenCalled();
  });

  it('ekle formu p-dialog olarak açılır ve kapanır', async () => {
    expect(dialogs()).toHaveLength(0);

    component.openBusForm();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dialogs()).toHaveLength(1);
    expect(dialogs()[0].querySelector('form')).not.toBeNull();

    // p-dialog kapat butonu -> visibleChange(false) -> closeBusForm()
    document.querySelector<HTMLElement>('.p-dialog-close-button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component['busFormVisible']()).toBe(false);
    expect(dialogs()).toHaveLength(0);
  });

  it('geçerli form kaydedilince servis çağrılır, liste yenilenir ve dialog kapanır', async () => {
    component.openBusForm();
    fixture.detectChanges();
    component['busForm'].patchValue({ plate: '06 XYZ 999', brand: 'Ford', model: 'Transit' });

    component.submitBus();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(busService.addBus).toHaveBeenCalled();
    expect(store.loadBuses).toHaveBeenCalled();
    expect(component['busFormVisible']()).toBe(false);
  });

  it('silme onayı p-dialog olarak açılır ve silince servis çağrılır', async () => {
    component['confirmBusDelete'](bus());
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dialogs()).toHaveLength(1);
    expect(dialogs()[0].querySelector('.delete-warning')).not.toBeNull();

    component['deleteBus']();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(busService.deleteBus).toHaveBeenCalledWith(1);
    expect(component['busDeleteVisible']()).toBe(false);
    expect(dialogs()).toHaveLength(0);
  });
});
