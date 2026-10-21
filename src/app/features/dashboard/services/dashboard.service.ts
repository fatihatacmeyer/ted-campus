import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiHelperService } from '../../../core/services/api-helper.service';

interface DashboardCampusRow {
  OgrenciSayisi?: number | null;
  VeliSayisi?: number | null;
  ToplamKayitliSayisi?: number | null;
  OgrenciOkuldaSayisi?: number | null;
  VeliOkuldaSayisi?: number | null;
  ToplamOkuldaSayisi?: number | null;
}

interface KvkkOnayRow {
  OgrenciOnaySayisi?: number | null;
  VeliOnaySayisi?: number | null;
  VekilOnaySayisi?: number | null;
  ServisOnaySayisi?: number | null;
  ToplamOnaySayisi?: number | null;
}

export interface KvkkStats {
  studentApproved: number;
  parentApproved: number;
  proxyApproved: number;
  serviceApproved: number;
  totalApproved: number;
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

export type PersonType = 'STUDENT' | 'PARENT';

export interface InsidePerson {
  id: number;
  fullName: string;
  type: PersonType;
  className: string | null;
  schoolName: string | null;
  registryNo: string | null;
  isInside: boolean;
  students: string | null;
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
  timestamp: number | null;
  className: string | null;
  campusName: string | null;
  direction: 'in' | 'out' | null;
  device: string;
  result: 'success' | 'failed' | 'service';
  isProxy: boolean;
  rawDirectionText: string;
  rawResultText: string;
}

interface RecentTransactionRow {
  userDef: string;
  adSoyad: string;
  EventTime: string;
  SicilNo: string | null;
  CardID: string | null;
  Ad: string | null;
  terminalAdi: string | null;
  Sinif: string | null;
  Kampus: string | null;
  Sonuc: string | null;
}

interface InsidePersonRow {
  SicilId: number;
  AdSoyad: string;
  Tur: string;
  Sinif: string | null;
  Okul: string | null;
  SicilNo: string | null;
  Okulda: number;
  Ogrenciler: string | null;
}

const PERSON_TYPE_TO_DB: Record<PersonType, string> = {
  STUDENT: 'OGRENCI',
  PARENT: 'VELI',
};

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private api = inject(ApiHelperService);

  getDashboardStats(): Observable<DashboardCampusStats> {
    return this.api
      .callEndpoint<DashboardCampusRow[]>('Dynamic', {
        point: 'DashboardCampus',
        islemtipi: 's',
      })
      .pipe(map((rows) => this.mapStats((rows || [])[0])));
  }

  getKvkkStats(): Observable<KvkkStats> {
    return this.api
      .callEndpoint<KvkkOnayRow[]>('Dynamic', {
        point: 'KvkkOnayCampus',
        islemtipi: 's',
      })
      .pipe(
        map((rows) => {
          const row = (rows || [])[0];
          return {
            studentApproved: this.toCount(row?.OgrenciOnaySayisi),
            parentApproved: this.toCount(row?.VeliOnaySayisi),
            proxyApproved: this.toCount(row?.VekilOnaySayisi),
            serviceApproved: this.toCount(row?.ServisOnaySayisi),
            totalApproved: this.toCount(row?.ToplamOnaySayisi),
          };
        }),
      );
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
            students: row.Ogrenciler || null,
          })),
        ),
      );
  }

  getRecentTransactions(adet = 10, ara?: string): Observable<AccessTransaction[]> {
    return this.api
      .callEndpoint<RecentTransactionRow[]>('Dynamic', {
        point: 'SonHareketlerCampus',
        islemtipi: 's',
        Adet: adet,
        Ara: ara?.trim() || undefined,
      })
      .pipe(
        map((rows) =>
          (rows || []).map((row, index) => {
            const sonuc = (row.Sonuc || '').toLowerCase();
            const userDef = (row.userDef || '').toLocaleUpperCase('tr-TR');
            const isProxy = userDef === 'VEKİL' || userDef === 'VEKIL';
            const isStudent = userDef.includes('ÖĞRENCİ') || userDef.includes('OGRENCI');

            let result: AccessTransaction['result'];
            if (sonuc.startsWith('başarısız')) {
              result = 'failed';
            } else if (sonuc === 'servis') {
              result = 'service';
            } else if (isProxy) {
              result = 'success';
            } else {
              result =
                sonuc.includes('onay') || sonuc === 'başarılı' || sonuc.includes('geçiş')
                  ? 'success'
                  : 'failed';
            }

            const directionText = (row.Ad || '').toLowerCase();
            const direction: AccessTransaction['direction'] = !directionText
              ? null
              : directionText.includes('giriş')
                ? 'in'
                : 'out';

            return {
              id: index + 1,
              personName: row.adSoyad || '-',
              registryNo: row.SicilNo || '-',
              userdef: isStudent ? 11 : 12,
              badgeClass: isProxy ? 'badge-proxy' : isStudent ? 'badge-student' : 'badge-parent',
              badgeLabel: row.userDef || '-',
              cardId: row.CardID || '-',
              time: this.formatEventTime(row.EventTime),
              timestamp: this.parseEventTimestamp(row.EventTime),
              className: row.Sinif || null,
              campusName: row.Kampus || null,
              direction,
              isProxy,
              rawDirectionText: row.Ad || '-',
              device: row.terminalAdi || '-',
              result,
              rawResultText: row.Sonuc || '-',
            };
          }),
        ),
      );
  }

  private parseEventTimestamp(dateStr: string): number | null {
    const time = dateStr ? new Date(dateStr).getTime() : NaN;
    return isNaN(time) ? null : time;
  }

  private formatEventTime(dateStr: string): string {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
    } catch {
      return dateStr;
    }
  }
}
