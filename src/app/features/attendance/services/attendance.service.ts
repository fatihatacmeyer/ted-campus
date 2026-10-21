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

interface StudentAttendanceRowRaw {
  SicilId: number;
  SicilNo: string;
  AdSoyad: string;
  Sinif: string;
  Kampus: string;
  EgitimDuzeyi: string;
  GelisServisPlaka: string | null;
  DonusServisPlaka: string | null;
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

@Injectable({
  providedIn: 'root',
})
export class AttendanceService {
  private api = inject(ApiHelperService);
  private typesService = inject(TypesService);

  private readonly point = 'pdks';

  private callDynamic<T>(params: Record<string, string | number>): Observable<T> {
    const requestParams: Record<string, string | number> = { point: this.point, ...params };
    return this.api.callEndpoint<T>('Dynamic', requestParams);
  }

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

  getLeaveTypes(): Observable<DropdownItem[]> {
    return this.typesService.getDropdownList('y_izintipleri', 0);
  }

  getLeaveBalance(): Observable<LeaveBalance> {
    return this.callDynamic<Record<string, unknown>>({
      point: 'izinhak',
      islemtipi: 's',
    }).pipe(map((raw) => this.mapLeaveBalance(raw ?? {})));
  }

  getMyLeaves(): Observable<LeaveRecord[]> {
    return this.callDynamic<Record<string, unknown>[]>({
      point: 'izinler',
      islemtipi: 'li',
    }).pipe(map((rows) => (rows || []).map((row) => this.mapLeaveRecord(row))));
  }

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

  cancelLeave(izinId: number): Observable<unknown> {
    return this.callDynamic<unknown>({ point: 'izintek', islemtipi: 'd', izinid: izinId });
  }

  private readonly studentPoint = 'OgrenciHareketRaporu';

  private callStudentDynamic<T>(params: Record<string, string | number>): Observable<T> {
    const requestParams: Record<string, string | number> = {
      point: this.studentPoint,
      islemtipi: 's',
      ...params,
    };
    return this.api.callEndpoint<T>('Dynamic', requestParams);
  }

  private mapRowToStudentAttendance(row: StudentAttendanceRowRaw): StudentAttendanceRow {
    return {
      sicilId: row.SicilId,
      sicilNo: row.SicilNo,
      adSoyad: row.AdSoyad,
      sinif: row.Sinif,
      kampus: row.Kampus,
      egitimDuzeyi: row.EgitimDuzeyi,
      gelisServisPlaka: row.GelisServisPlaka ?? null,
      donusServisPlaka: row.DonusServisPlaka ?? null,
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

  deleteStudentLeave(izinId: number | number[]): Observable<unknown> {
    return this.api.callEndpoint<unknown>('Dynamic', {
      point: 'izinlercampus',
      islemtipi: 'd',
      izinid: Array.isArray(izinId) ? izinId.join(';') : izinId,
    });
  }
}
