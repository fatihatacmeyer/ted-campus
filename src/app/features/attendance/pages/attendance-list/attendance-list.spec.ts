import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AttendanceListComponent } from './attendance-list';
import { AttendanceService } from '../../services/attendance.service';
import {
  AttendanceRow,
  LeaveBalance,
  LeaveRecord,
} from '../../../../core/models/attendance.model';
import { computePeriodRange } from '../../../../shared/utils/date.utils';

describe('AttendanceListComponent', () => {
  let component: AttendanceListComponent;
  let fixture: ComponentFixture<AttendanceListComponent>;
  let service: AttendanceService;

  /** Test row factory helper. */
  const mockRow = (overrides: Partial<AttendanceRow> = {}): AttendanceRow => ({
    sicilId: 1,
    sicilNo: '100',
    ad: 'Test',
    soyad: 'Personel',
    adSoyad: 'Test Personel',
    bolumAd: 'Bilgi İşlem',
    pozisyonAd: 'Uzman',
    mesaiTarih: '2026-08-06',
    giris: '2026-08-06T08:05:00',
    cikis: '2026-08-06T17:00:00',
    girisId: 1,
    cikisId: 1,
    elleGiris: 0,
    elleCikis: 0,
    gecKalma: 0,
    erkenCikma: 0,
    mesaiBas: '08:00',
    mesaiBit: '17:00',
    mesaiSuresi: 540,
    normalMesai: 540,
    araSure: 60,
    fazlaMesai: 0,
    izinSuresi: 0,
    yillikIzinSuresi: 0,
    eksikMesai: 0,
    mesaiAciklama: '',
    izinAciklama: '',
    kayitYetki: 0,
    onayMiPdks: false,
    ...overrides,
  });

  beforeEach(async () => {
    const serviceStub = {
      getAttendanceRows: vi.fn(() => of([])),
      getLeaveTypes: vi.fn(() => of([])),
      getLeaveBalance: vi.fn(() =>
        of<LeaveBalance>({
          yillikIzinHakTarihi: '2026-01-01',
          kidem: 5,
          hak: 20,
          kullanilanYillikIzin: 3,
          izinDevir: 0,
          kalan: 17,
        }),
      ),
      getMyLeaves: vi.fn(() => of([])),
      requestLeave: vi.fn(() => of(null)),
      cancelLeave: vi.fn(() => of(null)),
    } as unknown as AttendanceService;
    service = serviceStub;

    await TestBed.configureTestingModule({
      imports: [AttendanceListComponent],
      providers: [
        provideHttpClient(),
        MessageService,
        {
          provide: TranslateService,
          useValue: { instant: (key: string) => key },
        },
        { provide: AttendanceService, useValue: service },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AttendanceListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('bileşen oluşturulur', () => {
    expect(component).toBeTruthy();
  });

  it('ilk yükleme listeTip 0 ve bugünün aralığıyla servisi çağırır', () => {
    const expected = computePeriodRange('gun', new Date());
    expect(service.getAttendanceRows).toHaveBeenCalledWith(
      expect.objectContaining({
        listeTip: 0,
        baslangic: expected.baslangic,
        bitis: expected.bitis,
      }),
    );
  });

  it('sekme değişimi yeni listeTip ile listeyi yeniler', () => {
    vi.mocked(service.getAttendanceRows).mockClear();
    component.onTabChange(6);
    expect(component.activeTab()).toBe(6);
    expect(service.getAttendanceRows).toHaveBeenCalledWith(
      expect.objectContaining({ listeTip: 6 }),
    );
  });

  it('openLeaveDialog seçili satırı ayarlar ve dialogu gösterir', () => {
    const row = mockRow();
    component.openLeaveDialog(row);
    expect(component.selectedRow()).toEqual(row);
    expect(component.leaveDialogVisible()).toBe(true);
    expect(service.getLeaveTypes).toHaveBeenCalled();
    expect(service.getLeaveBalance).toHaveBeenCalled();
    expect(component.leaveForm.get('baslangic')?.value).toEqual(
      new Date(2026, 7, 6),
    );
  });

  it('cancelLeave onay sonrası servisi çağırır ve listeyi yeniler', () => {
    const rec: LeaveRecord = {
      id: 5,
      izinTipi: 'Yıllık İzin',
      bastarih: '2026-01-01',
      bittarih: '2026-01-02',
      ucretli: false,
      saatlik: false,
      durum: 'Talep',
    };
    vi.mocked(service.getMyLeaves).mockClear();

    component.cancelLeave(rec);
    expect(component.confirmCancelVisible()).toBe(true);

    component.confirmCancelLeave();
    expect(service.cancelLeave).toHaveBeenCalledWith(5);
    expect(service.getMyLeaves).toHaveBeenCalled();
    expect(component.confirmCancelVisible()).toBe(false);
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
