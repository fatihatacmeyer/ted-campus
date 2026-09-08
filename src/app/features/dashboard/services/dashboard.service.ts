import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiHelperService } from '../../../core/services/api-helper.service';

/**
 * sp_DashboardCampus_s'ten dönen ham DB satırı (Türkçe/DB sütun adları).
 *
 * Backend'deki generic "Dynamic" dispatcher, point + islemtipi kombinasyonuna
 * göre ilgili prosedürü çağırıyor:
 *   point=DashboardCampus & islemtipi=s -> sp_DashboardCampus_s (özet sayılar)
 *
 * Prosedür tek satır döner; Sicil -> UserList -> sys_userdef zincirinden
 * türü OGRENCI/VELI olan HERKES sayılır (LoginMeCampus'ta hesabı olsun
 * olmasın). "Okulda" kolonları, son geçiş kaydı (Pool/Terminaller) giriş
 * (IO=2) olan kişileri ifade eder.
 */
interface DashboardCampusRow {
  OgrenciSayisi?: number | null;
  VeliSayisi?: number | null;
  ToplamKayitliSayisi?: number | null;
  OgrenciOkuldaSayisi?: number | null;
  VeliOkuldaSayisi?: number | null;
  ToplamOkuldaSayisi?: number | null;
}

interface EarlyLeaverRaw {
  SicilId: number;
  AdSoyad: string;
  Sinif: string;
  Okul: string;
  CikisSaati: string;
  BeklenenCikisSaati: string;
  UserDef: number;
}

interface LateArrivalRaw {
  SicilId: number;
  AdSoyad: string;
  Sinif: string;
  Okul: string;
  GirisSaati: string;
  BeklenenGirisSaati: string;
  UserDef: number;
}

interface AbsenteeRaw {
  SicilId: number;
  AdSoyad: string;
  Sinif: string;
  Okul: string;
}

/** Kartlarda gösterilen özet istatistikler (null-safe sayılar). */
export interface DashboardCampusStats {
  studentCount: number;
  parentCount: number;
  totalRegisteredCount: number;
  studentInsideCount: number;
  parentInsideCount: number;
  totalInsideCount: number;
}

export interface EarlyLeaver {
  id: number;
  fullName: string;
  className: string;
  schoolName: string;
  exitTime: string;
  expectedExitTime: string;
  userdef: number;
}

export interface LateArrival {
  id: number;
  fullName: string;
  className: string;
  schoolName: string;
  entryTime: string;
  expectedEntryTime: string;
  userdef: number;
}

export interface Absentee {
  id: number;
  fullName: string;
  className: string;
  schoolName: string;
}

export interface AccessTransaction {
  id: number;
  personName: string;
  sicilno: string;
  userdef: number;
  badgeClass: string;
  badgeLabel: string;
  cardid: string;
  time: string;
  direction: 'in' | 'out';
  device: string;
  result: 'success' | 'failed';
  rawDirectionText: string;
  rawResultText: string;
}

interface SonHareketlerRow {
  userDef: string;
  adSoyad: string;
  EventTime: string;
  SicilNo: string;
  CardID: string;
  Ad: string;
  terminalAdi: string;
  Sonuc: string;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private api = inject(ApiHelperService);

  /**
   * sp_DashboardCampus_s üzerinden öğrenci/veli/toplam kayıtlı ve okuldaki
   * kişi sayılarını tek çağrıda çeker. Prosedür tek satır döndürür;
   * satır yoksa tüm sayılar 0 kabul edilir.
   */
  getDashboardStats(): Observable<DashboardCampusStats> {
    return this.api
      .callEndpoint<DashboardCampusRow[]>('Dynamic', {
        point: 'DashboardCampus',
        islemtipi: 's',
      })
      .pipe(map((rows) => this.mapStats((rows || [])[0])));
  }

  private mapStats(row: DashboardCampusRow | undefined): DashboardCampusStats {
    return {
      studentCount: this.toCount(row?.OgrenciSayisi),
      parentCount: this.toCount(row?.VeliSayisi),
      totalRegisteredCount: this.toCount(row?.ToplamKayitliSayisi),
      studentInsideCount: this.toCount(row?.OgrenciOkuldaSayisi),
      parentInsideCount: this.toCount(row?.VeliOkuldaSayisi),
      totalInsideCount: this.toCount(row?.ToplamOkuldaSayisi),
    };
  }

  private toCount(value: number | null | undefined): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  getEarlyLeavers(): Observable<EarlyLeaver[]> {
    return this.api
      .callEndpoint<EarlyLeaverRaw[]>('Dynamic', {
        point: 'ErkenCikanlarCampus',
        islemtipi: 's',
      })
      .pipe(
        map((rows) =>
          (rows || []).map((row) => ({
            id: row.SicilId,
            fullName: row.AdSoyad,
            className: row.Sinif,
            schoolName: row.Okul,
            exitTime: row.CikisSaati,
            expectedExitTime: row.BeklenenCikisSaati,
            userdef: row.UserDef,
          })),
        ),
      );
  }

  getLateArrivals(): Observable<LateArrival[]> {
    return this.api
      .callEndpoint<LateArrivalRaw[]>('Dynamic', {
        point: 'GecKalanlarCampus',
        islemtipi: 's',
      })
      .pipe(
        map((rows) =>
          (rows || []).map((row) => ({
            id: row.SicilId,
            fullName: row.AdSoyad,
            className: row.Sinif,
            schoolName: row.Okul,
            entryTime: row.GirisSaati,
            expectedEntryTime: row.BeklenenGirisSaati,
            userdef: row.UserDef,
          })),
        ),
      );
  }

  getAbsentees(): Observable<Absentee[]> {
    return this.api
      .callEndpoint<AbsenteeRaw[]>('Dynamic', {
        point: 'HicGelmeyenlerCampus',
        islemtipi: 's',
      })
      .pipe(
        map((rows) =>
          (rows || []).map((row) => ({
            id: row.SicilId,
            fullName: row.AdSoyad,
            className: row.Sinif,
            schoolName: row.Okul,
          })),
        ),
      );
  }

  getRecentTransactions(adet: number = 10): Observable<AccessTransaction[]> {
    return this.api
      .callEndpoint<SonHareketlerRow[]>('Dynamic', {
        point: 'SonHareketlerCampus',
        islemtipi: 's',
        Adet: adet,
      })
      .pipe(
        map((rows) =>
          (rows || []).map((row, index) => {
            // SQL'den gelen metinlere göre UI sınıflarını (renk/ikon) belirliyoruz
            const isSuccess =
              (row.Sonuc || '').toLowerCase().includes('onay') ||
              (row.Sonuc || '').toLowerCase() === 'başarılı' ||
              (row.Sonuc || '').toLowerCase().includes('geçiş');
            const isIn = (row.Ad || '').toLowerCase().includes('giriş');
            const isStudent =
              (row.userDef || '').toUpperCase().includes('ÖĞRENCİ') ||
              (row.userDef || '').toUpperCase().includes('OGRENCI');

            return {
              id: index + 1, // Satır numarası olarak kullanıyoruz
              personName: row.adSoyad || '-',
              sicilno: row.SicilNo || '-',
              userdef: isStudent ? 11 : 12, // UI renk ayrımları için
              badgeClass: isStudent ? 'badge-student' : 'badge-parent',
              badgeLabel: row.userDef || '-',
              cardid: row.CardID || '-',
              time: this.formatEventTime(row.EventTime),
              direction: isIn ? 'in' : 'out',
              rawDirectionText: row.Ad || '-',
              device: row.terminalAdi || '-',
              result: isSuccess ? 'success' : 'failed',
              rawResultText: row.Sonuc || '-',
            };
          }),
        ),
      );
  }

  // ISO veya SQL DateTime formatından sadece saat kısmını (HH:mm:ss) alır
  private formatEventTime(dateStr: string): string {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr.split(' ')[1] || dateStr;
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    } catch {
      return dateStr;
    }
  }
}
