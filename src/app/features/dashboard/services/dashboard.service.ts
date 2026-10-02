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

/** "O an okulda olan" kişi listesi (sp_DashboardKisilerCampus_s). */
/** Kişi türü filtresi / değeri. Backend karşılıkları: OGRENCI / VELI. */
export type PersonType = 'STUDENT' | 'PARENT';

export interface InsidePerson {
  id: number;
  fullName: string;
  type: PersonType;
  className: string | null;
  schoolName: string | null;
  registryNo: string | null;
  isInside: boolean;
}

export interface AccessTransaction {
  id: number;
  personName: string;
  registryNo: string;
  userdef: number;
  badgeClass: string;
  badgeLabel: string;
  cardId: string;
  time: string;
  direction: 'in' | 'out';
  device: string;
  result: 'success' | 'failed';
  rawDirectionText: string;
  rawResultText: string;
}

interface RecentTransactionRow {
  userDef: string;
  adSoyad: string;
  EventTime: string;
  SicilNo: string;
  CardID: string;
  Ad: string;
  terminalAdi: string;
  Sonuc: string;
}

/**
 * sp_DashboardKisilerCampus_s'ten dönen ham DB satırı (Türkçe/DB sütun adları).
 *
 * Backend'deki generic "Dynamic" dispatcher, point + islemtipi kombinasyonuna
 * göre ilgili prosedürü çağırıyor:
 *   point=DashboardKisilerCampus & islemtipi=s -> sp_DashboardKisilerCampus_s
 *
 * SadeceOkulda=1 sabiti ile yalnızca son geçişi giriş (IO=2) olan, yani "o an
 * okulda olan" kişiler döner; kayıtlı olup okulda olmayanlar listeye girmez.
 */
interface InsidePersonRow {
  SicilId: number;
  AdSoyad: string;
  Tur: string;
  Sinif: string | null;
  Okul: string | null;
  SicilNo: string | null;
  Okulda: number;
}

/** Backend'in beklediği kişi türü değerleri. */
const PERSON_TYPE_TO_DB: Record<PersonType, string> = {
  STUDENT: 'OGRENCI',
  PARENT: 'VELI',
};

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

  /**
   * sp_DashboardKisilerCampus_s üzerinden "o an okulda olan" kişi listesini
   * çeker. SadeceOkulda=1 sabiti, yalnızca son geçişi giriş (IO=2) olan
   * kişileri döndürür — kayıtlı olup okulda olmayanlar listeye girmez.
   * islemno bilinçli olarak gönderilmez; backend oturumdan çözer.
   */
  getInsidePersons(type: PersonType | null): Observable<InsidePerson[]> {
    return this.api
      .callEndpoint<InsidePersonRow[]>('Dynamic', {
        point: 'DashboardKisilerCampus',
        islemtipi: 's',
        Tip: type ? PERSON_TYPE_TO_DB[type] : undefined,
        SadeceOkulda: 1,
      })
      .pipe(
        map((rows) =>
          (rows || []).map((row) => ({
            id: row.SicilId,
            fullName: row.AdSoyad,
            type: row.Tur === 'OGRENCI' ? 'STUDENT' : 'PARENT',
            className: row.Sinif,
            schoolName: row.Okul,
            registryNo: row.SicilNo,
            isInside: row.Okulda === 1,
          })),
        ),
      );
  }

  getRecentTransactions(adet: number = 10): Observable<AccessTransaction[]> {
    return this.api
      .callEndpoint<RecentTransactionRow[]>('Dynamic', {
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
              registryNo: row.SicilNo || '-',
              userdef: isStudent ? 11 : 12, // UI renk ayrımları için
              badgeClass: isStudent ? 'badge-student' : 'badge-parent',
              badgeLabel: row.userDef || '-',
              cardId: row.CardID || '-',
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
