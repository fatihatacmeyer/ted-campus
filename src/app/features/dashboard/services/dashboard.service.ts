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
}

interface LateArrivalRaw {
  SicilId: number;
  AdSoyad: string;
  Sinif: string;
  Okul: string;
  GirisSaati: string;
  BeklenenGirisSaati: string;
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
}

export interface LateArrival {
  id: number;
  fullName: string;
  className: string;
  schoolName: string;
  entryTime: string;
  expectedEntryTime: string;
}

export interface Absentee {
  id: number;
  fullName: string;
  className: string;
  schoolName: string;
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
}
