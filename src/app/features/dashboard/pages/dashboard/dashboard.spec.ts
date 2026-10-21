import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { DashboardComponent } from './dashboard';
import { AuthService } from '../../../../core/services/auth.service';
import {
  DashboardCampusStats,
  DashboardService,
  InsidePerson,
} from '../../services/dashboard.service';
import { provideAppTesting } from '../../../../testing/test-providers';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let service: Record<string, ReturnType<typeof vi.fn>>;

  const stats: DashboardCampusStats = {
    studentCount: 120,
    parentCount: 90,
    totalRegisteredCount: 210,
    studentInsideCount: 100,
    parentInsideCount: 5,
    totalInsideCount: 105,
  };

  const insidePerson = (id: number, overrides: Partial<InsidePerson> = {}): InsidePerson => ({
    id,
    fullName: `Kişi ${id}`,
    type: 'STUDENT',
    className: '5-A',
    schoolName: 'Merkez',
    registryNo: String(id),
    isInside: true,
    students: null,
    ...overrides,
  });

  const flush = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    service = {
      getDashboardStats: vi.fn(() => of(stats)),
      getEarlyLeavers: vi.fn(() => of([])),
      getLateArrivals: vi.fn(() => of([])),
      getAbsentees: vi.fn(() =>
        of([{ id: 1, fullName: 'Gelmeyen Öğrenci', className: '5-A', schoolName: 'Merkez' }]),
      ),
      getKvkkStats: vi.fn(() =>
        of({
          studentApproved: 1,
          parentApproved: 1,
          proxyApproved: 1,
          serviceApproved: 1,
          totalApproved: 3,
        }),
      ),
      getRecentTransactions: vi.fn(() => of([])),
      getInsidePersons: vi.fn(() => of([insidePerson(1), insidePerson(2, { type: 'PARENT' })])),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        ...provideAppTesting(),
        { provide: DashboardService, useValue: service },
        { provide: AuthService, useValue: { currentUserValue: { fullname: 'Test Kullanıcı' } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    await flush();
  });

  afterEach(() => fixture.destroy());

  it('özet kartlarını, KVKK şeridini, üç liste kartını ve son hareketleri çizer', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('app-stat-card')).toHaveLength(3);
    expect(el.querySelectorAll('app-kvkk-card')).toHaveLength(1);
    expect(el.querySelectorAll('app-person-list-card')).toHaveLength(3);
    expect(el.querySelectorAll('app-transactions-card')).toHaveLength(1);
    expect(el.textContent).toContain('Test Kullanıcı');
    expect(el.textContent).toContain('Gelmeyen Öğrenci');
  });

  it('özet kartı tıklanınca okulda olanlar diyaloğu o türle açılır', async () => {
    fixture.nativeElement.querySelector('app-stat-card .stat-card').click();
    await flush();

    expect(service['getInsidePersons']).toHaveBeenCalledWith('STUDENT');
    await vi.waitFor(() =>
      expect(fixture.nativeElement.querySelectorAll('.p-dialog')).toHaveLength(1),
    );
    await vi.waitFor(() =>
      expect(fixture.nativeElement.querySelectorAll('.p-dialog .person-row')).toHaveLength(2),
    );
  });

  it('toplam kartı her iki türü birden ister (type = null)', async () => {
    fixture.nativeElement.querySelectorAll('app-stat-card .stat-card')[2].click();
    await flush();
    expect(service['getInsidePersons']).toHaveBeenCalledWith(null);
  });

  it('veri yüklenemezse hata bandı çıkar ve tekrar dene kartları yeniden yükler', async () => {
    fixture.destroy();
    service['getDashboardStats'].mockImplementation(() => {
      throw new Error('boom');
    });
    fixture = TestBed.createComponent(DashboardComponent);
    await flush();

    expect(fixture.nativeElement.querySelector('.error-banner')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-stat-card')).toBeNull();

    service['getDashboardStats'].mockImplementation(() => of(stats));
    fixture.nativeElement.querySelector('.error-banner button').click();
    await flush();
    expect(fixture.nativeElement.querySelectorAll('app-stat-card')).toHaveLength(3);
  });
});
