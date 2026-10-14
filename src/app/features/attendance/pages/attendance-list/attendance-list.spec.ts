import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AttendanceListComponent } from './attendance-list';
import { AttendanceService } from '../../services/attendance.service';
import { StudentAttendanceRow } from '../../../../core/models/attendance.model';
import { computePeriodRange } from '../../../../shared/utils/date.utils';
import { provideAppTesting } from '../../../../testing/test-providers';

describe('AttendanceListComponent', () => {
  let component: AttendanceListComponent;
  let fixture: ComponentFixture<AttendanceListComponent>;
  let service: {
    getStudentAttendanceRows: ReturnType<typeof vi.fn>;
    deleteStudentLeave: ReturnType<typeof vi.fn>;
  };

  /** Test satırı üretici. */
  const mockRow = (overrides: Partial<StudentAttendanceRow> = {}): StudentAttendanceRow => ({
    sicilId: 1,
    sicilNo: '100',
    adSoyad: 'Test Öğrenci',
    sinif: '5-A',
    kampus: 'Merkez',
    egitimDuzeyi: 'Ortaokul',
    gelisServisPlaka: null,
    donusServisPlaka: null,
    tarih: '2026-08-06',
    girisSaati: '08:05',
    cikisSaati: '15:00',
    gecKalmaSuresiDk: 0,
    erkenCikmaSuresiDk: 0,
    izinId: null,
    izinTipi: null,
    izinSaatAraligi: null,
    okulSaatleri: '08:00-15:00',
    ...overrides,
  });

  beforeEach(async () => {
    service = {
      getStudentAttendanceRows: vi.fn(() => of([] as StudentAttendanceRow[])),
      deleteStudentLeave: vi.fn(() => of(null)),
    };

    await TestBed.configureTestingModule({
      imports: [AttendanceListComponent],
      providers: [...provideAppTesting(), { provide: AttendanceService, useValue: service }],
    }).compileComponents();

    fixture = TestBed.createComponent(AttendanceListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('bileşen oluşturulur', () => {
    expect(component).toBeTruthy();
  });

  it('ilk yükleme GosterimTuru 0 ve bugünün aralığıyla servisi çağırır', () => {
    const expected = computePeriodRange('gun', new Date());
    expect(service.getStudentAttendanceRows).toHaveBeenCalledWith(
      expect.objectContaining({
        GosterimTuru: 0,
        baslangic: expected.baslangic,
        bitis: expected.bitis,
      }),
    );
  });

  it('sekme değişimi yeni GosterimTuru ile listeyi yeniler', () => {
    service.getStudentAttendanceRows.mockClear();
    component.onTabChange(2);
    expect(component.activeTab()).toBe(2);
    expect(service.getStudentAttendanceRows).toHaveBeenCalledWith(
      expect.objectContaining({ GosterimTuru: 2 }),
    );
  });

  it('arama metni adSoyadArama olarak gönderilir', () => {
    service.getStudentAttendanceRows.mockClear();
    component.onSearch('ayşe');
    expect(service.getStudentAttendanceRows).toHaveBeenCalledWith(
      expect.objectContaining({ adSoyadArama: 'ayşe' }),
    );
  });

  it('openLeaveIconDialog seçili satırı ayarlar ve dialogu gösterir', () => {
    const row = mockRow({ izinId: 5, izinTipi: 'Raporlu' });
    component.openLeaveIconDialog(row);
    expect(component.selectedLeaveRow()).toEqual(row);
    expect(component.leaveIconDialogVisible()).toBe(true);
  });

  it('selectedLeaveIds aynı izin kaydını tekilleştirir, izinsizleri atlar', () => {
    component.selectedRows.set([
      mockRow({ sicilId: 1, izinId: 5 }),
      mockRow({ sicilId: 2, izinId: 5 }),
      mockRow({ sicilId: 3, izinId: null }),
      mockRow({ sicilId: 4, izinId: 7 }),
    ]);
    expect(component.selectedLeaveIds()).toEqual([5, 7]);
  });

  it('deleteLeave servisi çağırır', () => {
    component.deleteLeave(5);
    expect(service.deleteStudentLeave).toHaveBeenCalledWith(5);
  });

  it('computePeriodRange: hafta ay sınırını aşar (29 Haz – 5 Tem 2026)', () => {
    // 30 Haziran 2026 Salı — hafta 29 Haziran Pazartesi başlar, 5 Temmuz Pazar biter.
    const r = computePeriodRange('hafta', new Date(2026, 5, 30));
    expect(r.baslangic).toBe('2026-06-29');
    expect(r.bitis).toBe('2026-07-05');
  });

  it('computePeriodRange: ay başlangıç ve bitişini verir', () => {
    const r = computePeriodRange('ay', new Date(2026, 7, 15));
    expect(r.baslangic).toBe('2026-08-01');
    expect(r.bitis).toBe('2026-08-31');
  });
});
