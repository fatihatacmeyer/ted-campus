import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  AttendanceListType,
  AttendanceRow,
  LeaveBalance,
  LeaveRecord,
  LeaveRequest,
  StudentAttendanceFilterType,
  StudentAttendanceRow,
} from '../../../core/models/attendance.model';
import { ApiHelperService } from '../../../core/services/api-helper.service';
import { DropdownItem, TypesService } from '../../../features/persons/services/types.service';

/** Raw DB row returned from sp_pdks_s (Turkish/DB column names). */
interface AttendanceRowRaw {
  SicilId: number;
  SicilNo: string;
  Ad: string;
  Soyad: string;
  BolumAd: string;
  PozisyonAd: string;
  MesaiTarih: string;
  GGiris: string | null;
  GCikis: string | null;
  GirisId: number;
  CikisId: number;
  Ellegiris: number;
  Ellecikis: number;
  Geckalma: number;
  Erkencikma: number;
  MesaiBas: string;
  MesaiBit: string;
  Mesaisuresi: number;
  Normalmesai: number;
  Arasure: number;
  Fazlamesai: number;
  Izinsuresi: number;
  Yillikizinsuresi: number;
  Eksikmesai: number;
  Mesaiaciklama: string;
  Izinaciklama: string;
  Kayityetki: number;
  Onaymipdks: boolean | number;
}

/** Raw DB row returned from sp_OgrenciHareketRaporu_s (PascalCase column names). */
interface StudentAttendanceRowRaw {
  SicilId: number;
  SicilNo: string;
  AdSoyad: string;
  Sinif: string;
  Kampus: string;
  EgitimDuzeyi: string;
  Tarih: string;
  GirisSaati: string | null;
  CikisSaati: string | null;
  GecKalmaSuresiDk: number;
  ErkenCikmaSuresiDk: number;
  IzinId: number | null;
  IzinTipi: string | null;
  IzinSaatAraligi: string | null;
  OkulSaatleri: string;
}

/**
 * Attendance (PDKS) personnel tracking and leave request service.
 *
 * Backend'deki generic "Dynamic" dispatcher, point + islemtipi kombinasyonuna
 * göre ilgili prosedürü çağırıyor:
 *   point=pdks & islemtipi=s -> sp_pdks_s (mesai listesi)
 *   point=izinhak & islemtipi=s -> izin hakkı özeti
 *   point=izinler & islemtipi=li -> personelin izin talepleri
 *   point=talep & islemtipi=ic -> yeni izin talebi ekle
 *   point=izintek & islemtipi=d -> izin talebi sil
 *
 * NOT (ActivityService ile birebir aynı desen):
 * param string'i asla encode edilmiyor, tek parça halinde AES ile
 * şifrelenip "Name" query parametresi olarak GET isteğiyle gönderiliyor.
 * Şifreleme ApiHelperService.callEndpoint içinde yapılır.
 */
@Injectable({
  providedIn: 'root',
})
export class AttendanceService {
  private api = inject(ApiHelperService);
  private typesService = inject(TypesService);

  /** Backend dispatcher point'i (değiştirilmemeli — sp_pdks_* prosedürleriyle eşleşir). */
  private readonly point = 'pdks';

  private callDynamic<T>(params: Record<string, string | number>): Observable<T> {
    const requestParams: Record<string, string | number> = { point: this.point, ...params };
    return this.api.callEndpoint<T>('Dynamic', requestParams);
  }

  /**
   * sp_pdks_s sonuç sütunlarını (Türkçe/DB isimleri) AttendanceRow'a çevirir.
   * DİKKAT: Sütun adları backend prosedürüyle birebir eşleşmek zorundadır;
   * adSoyad UI tarafında Ad + Soyad birleştirilerek üretilir, onayMiPdks ise
   * backend'deki sayısal/bool Onaymipdks alanından boolean'a çevrilir.
   */
  private mapRowToAttendance(row: AttendanceRowRaw): AttendanceRow {
    return {
      sicilId: row.SicilId,
      sicilNo: row.SicilNo,
      ad: row.Ad,
      soyad: row.Soyad,
      adSoyad: `${row.Ad} ${row.Soyad}`,
      bolumAd: row.BolumAd,
      pozisyonAd: row.PozisyonAd,
      mesaiTarih: row.MesaiTarih,
      giris: row.GGiris,
      cikis: row.GCikis,
      girisId: row.GirisId,
      cikisId: row.CikisId,
      elleGiris: row.Ellegiris,
      elleCikis: row.Ellecikis,
      gecKalma: row.Geckalma,
      erkenCikma: row.Erkencikma,
      mesaiBas: row.MesaiBas,
      mesaiBit: row.MesaiBit,
      mesaiSuresi: row.Mesaisuresi,
      normalMesai: row.Normalmesai,
      araSure: row.Arasure,
      fazlaMesai: row.Fazlamesai,
      izinSuresi: row.Izinsuresi,
      yillikIzinSuresi: row.Yillikizinsuresi,
      eksikMesai: row.Eksikmesai,
      mesaiAciklama: row.Mesaiaciklama,
      izinAciklama: row.Izinaciklama,
      kayitYetki: row.Kayityetki,
      onayMiPdks: !!row.Onaymipdks,
    };
  }

  /**
   * İzin hakkı yanıtını LeaveBalance'a çevirir.
   * Backend PascalCase (Kalan, Hak, Kidem...) dönebildiği için her iki kas
   * varyasyonuna da toleranslıdır; eksik alanlar varsayılanla doldurulur.
   */
  private mapLeaveBalance(raw: Record<string, unknown>): LeaveBalance {
    return {
      yillikIzinHakTarihi: String(raw['YillikIzinHakTarihi'] ?? raw['yillikIzinHakTarihi'] ?? ''),
      kidem: Number(raw['Kidem'] ?? raw['kidem'] ?? 0),
      hak: Number(raw['Hak'] ?? raw['hak'] ?? 0),
      kullanilanYillikIzin: Number(raw['KullanilanYillikIzin'] ?? raw['kullanilanYillikIzin'] ?? 0),
      izinDevir: Number(raw['IzinDevir'] ?? raw['izinDevir'] ?? 0),
      kalan: Number(raw['Kalan'] ?? raw['kalan'] ?? 0),
    };
  }

  /**
   * İzin talebi kaydını LeaveRecord'a çevirir.
   * Backend sütunu 'izintipi' (küçük harf) döner; durum alanı yoksa 'Talep'
   * varsayılır (bekleyen talep anlamında).
   */
  private mapLeaveRecord(raw: Record<string, unknown>): LeaveRecord {
    return {
      id: Number(raw['Id'] ?? raw['id'] ?? 0),
      izinTipi: String(raw['IzinTipi'] ?? raw['izintipi'] ?? raw['izinTipi'] ?? ''),
      bastarih: String(raw['Bastarih'] ?? raw['bastarih'] ?? ''),
      bittarih: String(raw['Bittarih'] ?? raw['bittarih'] ?? ''),
      ucretli: !!(raw['Ucretli'] ?? raw['ucretli']),
      saatlik: !!(raw['Saatlik'] ?? raw['saatlik']),
      durum: String(raw['Durum'] ?? raw['durum'] ?? 'Talep'),
    };
  }

  /**
   * Attendance mesai listesini döndürür.
   * listeTip'e göre sekme filtresi uygulanır:
   * 0=genel liste, 4=geç gelenler, 5=erken çıkanlar, 6=izinliler.
   */
  getAttendanceRows(params: {
    listeTip: AttendanceListType;
    baslangic: string;
    bitis: string;
    ad?: string;
    bolum?: string;
  }): Observable<AttendanceRow[]> {
    return this.callDynamic<AttendanceRowRaw[]>({
      islemtipi: 's',
      tip: params.listeTip,
      baslangic: params.baslangic,
      bitis: params.bitis,
      ad: params.ad ?? '',
      bolum: params.bolum ?? '',
    }).pipe(map((rows) => (rows || []).map((row) => this.mapRowToAttendance(row))));
  }

  /** İzin tipi combosu için dropdown listesini döndürür (cbo_izintipleri). */
  getLeaveTypes(): Observable<DropdownItem[]> {
    return this.typesService.getDropdownList('y_izintipleri', 0);
  }

  /** Personelin yıllık izin hakkı özetini döndürür. */
  getLeaveBalance(): Observable<LeaveBalance> {
    return this.callDynamic<Record<string, unknown>>({
      point: 'izinhak',
      islemtipi: 's',
    }).pipe(map((raw) => this.mapLeaveBalance(raw ?? {})));
  }

  /** Personelin kendi izin taleplerini (talep geçmişini) döndürür. */
  getMyLeaves(): Observable<LeaveRecord[]> {
    return this.callDynamic<Record<string, unknown>[]>({
      point: 'izinler',
      islemtipi: 'li',
    }).pipe(map((rows) => (rows || []).map((row) => this.mapLeaveRecord(row))));
  }

  /**
   * Yeni izin talebi oluşturur.
   * Legacy talepkaydet kontratıyla uyumlu parametreler gönderilir
   * (kaynak='izin', siciller=tek sicil no — yalnızca tek personel talebi).
   */
  requestLeave(req: LeaveRequest): Observable<unknown> {
    return this.callDynamic<unknown>({
      point: 'talep',
      islemtipi: 'ic',
      kaynak: 'izin',
      tip: req.izinTipId,
      bastarih: req.baslangic,
      bittarih: req.bitis,
      siciller: req.sicilId ? String(req.sicilId) : '',
      saatbas: req.baslangicSaat ?? '',
      saatbit: req.bitisSaat ?? '',
      ucretli: req.ucretli ? 1 : 0,
      saatlik: req.saatlik ? 1 : 0,
      izinadresi: req.adres,
      aciklama: req.aciklama,
    });
  }

  /** Bekleyen bir izin talebini iptal eder. */
  cancelLeave(izinId: number): Observable<unknown> {
    return this.callDynamic<unknown>({ point: 'izintek', islemtipi: 'd', izinid: izinId });
  }

  // ────────────────────────────────────────────────────────────────
  // Öğrenci Devam — sp_OgrenciHareketRaporu_s
  // ────────────────────────────────────────────────────────────────

  /** Backend dispatcher point'i öğrenci hareket raporu prosedürüyle eşleşir. */
  private readonly studentPoint = 'OgrenciHareketRaporu';

  private callStudentDynamic<T>(params: Record<string, string | number>): Observable<T> {
    const requestParams: Record<string, string | number> = {
      point: this.studentPoint,
      islemtipi: 's',
      ...params,
    };
    return this.api.callEndpoint<T>('Dynamic', requestParams);
  }

  /** sp_OgrenciHareketRaporu_s sonuç sütunlarını StudentAttendanceRow'a çevirir. */
  private mapRowToStudentAttendance(row: StudentAttendanceRowRaw): StudentAttendanceRow {
    return {
      sicilId: row.SicilId,
      sicilNo: row.SicilNo,
      adSoyad: row.AdSoyad,
      sinif: row.Sinif,
      kampus: row.Kampus,
      egitimDuzeyi: row.EgitimDuzeyi,
      tarih: row.Tarih,
      girisSaati: row.GirisSaati,
      cikisSaati: row.CikisSaati,
      gecKalmaSuresiDk: row.GecKalmaSuresiDk,
      erkenCikmaSuresiDk: row.ErkenCikmaSuresiDk,
      izinId: row.IzinId,
      izinTipi: row.IzinTipi,
      izinSaatAraligi: row.IzinSaatAraligi,
      okulSaatleri: row.OkulSaatleri,
    };
  }

  /**
   * Öğrenci devam listesini döndürür.
   * gosterimTuru'ne göre sekme filtresi uygulanır:
   * 0=genel liste, 1=izinliler, 2=erken çıkanlar, 3=geç gelenler.
   *
   * SP: sp_OgrenciHareketRaporu_s
   * @FiltreTipi, @Tarih, @BaslangicTarih, @BitisTarih, @AdSoyadArama,
   * @SicilId, @SinifId, @KampusId, @GosterimTuru
   * (point/islemtipi/islemno SP tarafından kullanılmaz)
   */
  getStudentAttendanceRows(params: {
    GosterimTuru: StudentAttendanceFilterType;
    baslangic?: string;
    bitis?: string;
    tarih?: string;
    filtreTipi?: 'Gun' | 'Hafta' | 'Ay';
    adSoyadArama?: string;
    sicilId?: number;
    sinifId?: number;
    kampusId?: number;
  }): Observable<StudentAttendanceRow[]> {
    const spParams: Record<string, string | number> = {
      GosterimTuru: params.GosterimTuru,
    };

    // BaslangicTarih + BitisTarih verilirse SP doğrudan bu aralığı kullanır
    // ve FiltreTipi/Tarih'i yok sayar.
    if (params.baslangic && params.bitis) {
      spParams['BaslangicTarih'] = params.baslangic;
      spParams['BitisTarih'] = params.bitis;
    } else {
      spParams['FiltreTipi'] = params.filtreTipi ?? 'Gun';
      spParams['Tarih'] = params.tarih ?? '';
    }

    if (params.adSoyadArama) {
      spParams['AdSoyadArama'] = params.adSoyadArama;
    }
    if (params.sicilId != null) {
      spParams['SicilId'] = params.sicilId;
    }
    if (params.sinifId != null) {
      spParams['SinifId'] = params.sinifId;
    }
    if (params.kampusId != null) {
      spParams['KampusId'] = params.kampusId;
    }

    return this.callStudentDynamic<StudentAttendanceRowRaw[]>(spParams).pipe(
      map((rows) => (rows || []).map((row) => this.mapRowToStudentAttendance(row))),
    );
  }

  deleteStudentLeave(izinId: number): Observable<unknown> {
    return this.api.callEndpoint<unknown>('Dynamic', {
      point: 'izinlercampus',
      islemtipi: 'd',
      izinid: izinId,
    });
  }
}
