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

/**
 * sp_KvkkOnayCampus_s'ten dönen tek satır: KVKK onaylayan (uygulamayı kurup
 * giriş yapan) kişi sayıları. Kişi başı tek sayılır; vekillerin Sicil kaydı yok.
 *   point=KvkkOnayCampus & islemtipi=s -> sp_KvkkOnayCampus_s
 */
interface KvkkOnayRow {
  OgrenciOnaySayisi?: number | null;
  VeliOnaySayisi?: number | null;
  VekilOnaySayisi?: number | null;
  ToplamOnaySayisi?: number | null;
}

export interface KvkkStats {
  studentApproved: number;
  parentApproved: number;
  proxyApproved: number;
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
  /** Kişinin sınıfı / kampüsü (tanımsızsa null). Vekilde bağlı olduğu öğrencinin. */
  className: string | null;
  campusName: string | null;
  /** Yön bilinmiyorsa (vekil geçişinde yön kaydı yoksa) null. */
  direction: 'in' | 'out' | null;
  device: string;
  /** 'service': servis geçişi (OlayKodu 4102 + terminal 55/56) — hata değildir. */
  result: 'success' | 'failed' | 'service';
  /** Vekil geçişi: Sonuc serbest metindir (log Response), çevrilmez. */
  isProxy: boolean;
  rawDirectionText: string;
  rawResultText: string;
}

/**
 * sp_SonHareketlerCampus_s'ten dönen ham satır. Öğrenci/veli geçişlerine
 * (pool) ek olarak vekil geçişleri de gelir (userDef = 'Vekil'; SicilNo,
 * CardID boş, Ad/terminalAdi yön/terminal kaydı yoksa NULL olabilir).
 * Sonuc: 'Servis' | olay açıklaması | vekil Response metni | 'Başarısız: ...'.
 */
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

  /** sp_KvkkOnayCampus_s: onaylayan öğrenci/veli/vekil sayıları (tek satır). */
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

  /** @param ara isimden arama (backend @Ara); boşsa filtre uygulanmaz. */
  getRecentTransactions(adet: number = 10, ara?: string): Observable<AccessTransaction[]> {
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
            // SQL'den gelen metinlere göre UI sınıflarını (renk/ikon) belirliyoruz
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
              // Vekil Response'u serbest metin: "Başarısız:" ile başlamıyorsa başarılı.
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
              id: index + 1, // Satır numarası olarak kullanıyoruz
              personName: row.adSoyad || '-',
              registryNo: row.SicilNo || '-',
              userdef: isStudent ? 11 : 12, // UI renk ayrımları için
              badgeClass: isProxy ? 'badge-proxy' : isStudent ? 'badge-student' : 'badge-parent',
              badgeLabel: row.userDef || '-',
              cardId: row.CardID || '-',
              time: this.formatEventTime(row.EventTime),
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
