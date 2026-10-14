import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHelperService } from '../../../core/services/api-helper.service';
import { unwrapResponse } from '../../../shared/utils/response.utils';
import {
  Bus,
  BusDirection,
  StudentAssignment,
  StudentAssignmentFilter,
  StudentBusPlan,
  StudentBusPlanInput,
  BusDashboardStats,
  AuthorityAssignment,
  ServiceAuthority,
  DBInsertResult,
} from '../models/school-bus.model';

interface ServisCampusRow {
  Id: number;
  Plaka: string;
  Marka: string;
  Model: string;
  KoltukSayisi: number;
  DoluKoltukGidis: number;
  BosKoltukGidis: number;
  DoluKoltukDonus: number;
  BosKoltukDonus: number;
  Aciklama: string;
  Durum: string;
}

interface OgrenciServisCampusRow {
  Id: number;
  OgrenciSicilId: number;
  OgrenciAdSoyad: string;
  Sinif: string | null;
  Kampus: string | null;
  ServisId: number;
  Plaka: string;
  Marka: string;
  Model: string;
  Yon: number;
  YonAciklama: string;
}

interface OgrenciServisPlanRow {
  Id: number;
  OgrenciSicilId: number;
  OgrenciAdSoyad: string;
  Sinif: string | null;
  Kampus: string | null;
  ServisId: number | null;
  Plaka: string | null;
  ServisKullanmiyor: boolean | number;
  Yon: number;
  YonAciklama: string;
  TekrarTuru: string;
  Tarih: string | null;
  HaftaGunu: number | null;
  HaftaGunuAciklama: string | null;
  BaslangicTarih: string | null;
  BitisTarih: string | null;
  Aciklama: string | null;
  IsActive: boolean | number;
  OlusturanAdSoyad: string | null;
  CreatedDate: string | null;
  GuncelleyenAdSoyad: string | null;
  UpdatedDate: string | null;
}

interface ServisKullaniciRow {
  SicilId: number;
  SicilNo: string;
  AdSoyad: string;
  CepTelefon: string | null;
  Email: string | null;
  UserType: string;
}

interface AuthorityServisRow {
  Id: number;
  YetkiliSicilId: number;
  YetkiliAdSoyad: string;
  ServisId: number;
  Plaka: string;
  Marka: string;
  Model: string;
  CreatedDate: string | null;
}

interface ServisDashboardRow {
  ToplamServisKullanan: number;
  ToplamArac: number;
  AktifArac: number;
  BakimdakiArac: number;
  PasifArac: number;
}

@Injectable({
  providedIn: 'root',
})
export class SchoolBusService {
  private api = inject(ApiHelperService);

  getDashboardStats(): Observable<BusDashboardStats> {
    return this.api
      .callEndpoint<ServisDashboardRow[]>('Dynamic', { point: 'ServisDashboard', islemtipi: 's' })
      .pipe(
        map((rows) => {
          const row = rows?.[0];
          return {
            totalPassengers: row?.ToplamServisKullanan ?? 0,
            totalBuses: row?.ToplamArac ?? 0,
            activeBuses: row?.AktifArac ?? 0,
            maintenanceBuses: row?.BakimdakiArac ?? 0,
            passiveBuses: row?.PasifArac ?? 0,
          };
        }),
      );
  }

  getBuses(): Observable<Bus[]> {
    return this.api
      .callEndpoint<ServisCampusRow[]>('Dynamic', { point: 'serviscampus', islemtipi: 's' })
      .pipe(
        map((rows) =>
          (rows || []).map((row) => ({
            id: row.Id,
            plate: row.Plaka,
            brand: row.Marka,
            model: row.Model,
            seatCount: row.KoltukSayisi,
            doluKoltukGidis: row.DoluKoltukGidis,
            bosKoltukGidis: row.BosKoltukGidis,
            doluKoltukDonus: row.DoluKoltukDonus,
            bosKoltukDonus: row.BosKoltukDonus,
            description: row.Aciklama,
            status: row.Durum,
          })),
        ),
      );
  }

  addBus(bus: Omit<Bus, 'id'>): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<DBInsertResult[]>('Dynamic', {
        point: 'serviscampus',
        islemtipi: 'i',
        plaka: bus.plate,
        marka: bus.brand,
        model: bus.model,
        koltuksayisi: bus.seatCount,
        aciklama: bus.description,
        durum: bus.status,
      })
      .pipe(map(this.mapStandardResponse));
  }

  updateBus(id: number, bus: Omit<Bus, 'id'>): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<DBInsertResult[]>('Dynamic', {
        point: 'serviscampus',
        islemtipi: 'u',
        Id: id,
        plaka: bus.plate,
        marka: bus.brand,
        model: bus.model,
        koltuksayisi: bus.seatCount,
        aciklama: bus.description,
        durum: bus.status,
      })
      .pipe(map(this.mapStandardResponse));
  }

  deleteBus(id: number): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<DBInsertResult[]>('Dynamic', { point: 'serviscampus', islemtipi: 'd', Id: id })
      .pipe(map(this.mapStandardResponse));
  }

  getStudentAssignments(filter: StudentAssignmentFilter = {}): Observable<StudentAssignment[]> {
    return this.api
      .callEndpoint<OgrenciServisCampusRow[]>('Dynamic', {
        point: 'ogrenciserviscampus',
        islemtipi: 's',
        Id: filter.id ?? '',
        OgrenciSicilId: filter.ogrenciSicilId ?? '',
        ServisId: filter.servisId ?? '',
        Yon: filter.yon ?? '',
      })
      .pipe(
        map((rows) =>
          (rows || []).map((row) => ({
            id: row.Id,
            ogrenciSicilId: row.OgrenciSicilId,
            ogrenciAdSoyad: row.OgrenciAdSoyad,
            sinif: row.Sinif,
            kampus: row.Kampus,
            servisId: row.ServisId,
            plaka: row.Plaka,
            marka: row.Marka,
            model: row.Model,
            yon: row.Yon as BusDirection,
            yonAciklama: row.YonAciklama,
          })),
        ),
      );
  }

  assignStudentToBus(
    ogrenciSicilId: number,
    servisId: number,
    yon: BusDirection,
  ): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<DBInsertResult[]>('Dynamic', {
        point: 'ogrenciserviscampus',
        islemtipi: 'i',
        OgrenciSicilId: ogrenciSicilId,
        ServisId: servisId,
        Yon: yon,
      })
      .pipe(map(this.mapStandardResponse));
  }

  removeStudentAssignment(id: number): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<DBInsertResult[]>('Dynamic', {
        point: 'ogrenciserviscampus',
        islemtipi: 'd',
        Id: id,
      })
      .pipe(map(this.mapStandardResponse));
  }

  /**
   * sp_ogrenciservisplancampus_s: öğrenci servis planları. Prosedürün tüm
   * filtreleri opsiyonel; liste istemci tarafında tablo filtreleriyle daraltılır.
   */
  getStudentBusPlans(): Observable<StudentBusPlan[]> {
    return this.api
      .callEndpoint<OgrenciServisPlanRow[]>('Dynamic', {
        point: 'ogrenciservisplancampus',
        islemtipi: 's',
      })
      .pipe(
        map((rows) =>
          (rows || []).map((row) => ({
            id: row.Id,
            ogrenciSicilId: row.OgrenciSicilId,
            ogrenciAdSoyad: row.OgrenciAdSoyad,
            sinif: row.Sinif,
            kampus: row.Kampus,
            servisId: row.ServisId,
            plaka: row.Plaka,
            servisKullanmiyor: !!row.ServisKullanmiyor,
            yon: row.Yon as BusDirection,
            yonAciklama: row.YonAciklama,
            tekrarTuru: row.TekrarTuru,
            gunAciklama: row.Tarih ? this.formatDate(row.Tarih) : (row.HaftaGunuAciklama ?? '-'),
            baslangicTarih: row.BaslangicTarih ? this.formatDate(row.BaslangicTarih) : null,
            bitisTarih: row.BitisTarih ? this.formatDate(row.BitisTarih) : null,
            tarih: this.toIsoDate(row.Tarih),
            haftaGunu: row.HaftaGunu ? Number(row.HaftaGunu) : null,
            baslangicIso: this.toIsoDate(row.BaslangicTarih),
            bitisIso: this.toIsoDate(row.BitisTarih),
            aciklama: row.Aciklama,
            isActive: !!row.IsActive,
            olusturanAdSoyad: row.OlusturanAdSoyad,
            olusturmaTarihi: row.CreatedDate ? this.formatDate(row.CreatedDate, true) : null,
            guncelleyenAdSoyad: row.GuncelleyenAdSoyad,
            guncellemeTarihi: row.UpdatedDate ? this.formatDate(row.UpdatedDate, true) : null,
          })),
        ),
      );
  }

  /** Tüm Yön x Gün kombinasyonları tek işlemde eklenir; biri çakışırsa hiçbiri eklenmez. */
  addStudentBusPlan(
    ogrenciSicilId: number,
    plan: StudentBusPlanInput,
  ): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<DBInsertResult[]>('Dynamic', {
        point: 'ogrenciservisplancampus',
        islemtipi: 'i',
        OgrenciSicilId: ogrenciSicilId,
        ...this.planParams(plan),
      })
      .pipe(map(this.mapStandardResponse));
  }

  /**
   * Tam güncelleme: prosedür tüm alanları yollanan değerle değiştirir (öğrenci hariç).
   * Birden fazla yön/gün gönderilirse ilk kombinasyon bu kaydı günceller, kalanlar
   * yeni kayıt olarak eklenir (tek işlemde; çakışmada hiçbiri değişmez).
   */
  updateStudentBusPlan(
    id: number,
    plan: StudentBusPlanInput,
  ): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<DBInsertResult[]>('Dynamic', {
        point: 'ogrenciservisplancampus',
        islemtipi: 'u',
        Id: id,
        ...this.planParams(plan),
        IsActive: plan.isActive === undefined ? '' : String(plan.isActive),
      })
      .pipe(map(this.mapStandardResponse));
  }

  deleteStudentBusPlan(id: number): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<DBInsertResult[]>('Dynamic', {
        point: 'ogrenciservisplancampus',
        islemtipi: 'd',
        Id: id,
      })
      .pipe(map(this.mapStandardResponse));
  }

  /**
   * Boş değerler '' gider; prosedür '' / 0 / 1900-01-01'i NULL sayar.
   * Yön ve hafta günleri ';' ile birleştirilir ('1;2', '2;4').
   */
  private planParams(plan: StudentBusPlanInput) {
    return {
      ServisId: plan.servisId ?? '',
      Yon: plan.yon.join(';'),
      Tarih: plan.tarih ?? '',
      HaftaGunu: plan.haftaGunu.join(';'),
      BaslangicTarih: plan.baslangicTarih ?? '',
      BitisTarih: plan.bitisTarih ?? '',
      Aciklama: plan.aciklama ?? '',
    };
  }

  /** API tarihini form/gönderim için yyyy-MM-dd yapar; boş/ayrıştırılamazsa null. */
  private toIsoDate(value: string | null | undefined): string | null {
    if (!value) return null;
    const match = /^\d{4}-\d{2}-\d{2}/.exec(value);
    if (match) return match[0];
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  /** ISO / SQL tarihini dd.MM.yyyy (withTime ile HH:mm) olarak döndürür; ayrıştırılamazsa olduğu gibi. */
  private formatDate(value: string, withTime = false): string {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
    return withTime ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
  }

  /**
   * sp_serviskullanicilarcampus_s: servis yetkililerinin listesi.
   * (Prosedür @Ara ile isim araması da destekler; liste küçük olduğu için
   * arama tablonun kendi arama kutusunda istemci tarafında yapılır.)
   */
  getServiceAuthorities(): Observable<ServiceAuthority[]> {
    return this.api
      .callEndpoint<ServisKullaniciRow[]>('Dynamic', {
        point: 'serviskullanicilarcampus',
        islemtipi: 's',
      })
      .pipe(
        map((rows) =>
          (rows || []).map((row) => ({
            sicilId: row.SicilId,
            sicilNo: row.SicilNo,
            adSoyad: row.AdSoyad,
            cepTelefon: row.CepTelefon ?? null,
            email: row.Email ?? null,
          })),
        ),
      );
  }

  /**
   * "Bilgileri Gönder": öğrenci/veli akışındaki sp_loginsendcampus_d ile aynı —
   * kullanıcının mevcut giriş kaydı silinir ve yeni giriş bilgileri gönderilir.
   * Yanıt alan adlarının büyük/küçük harfi prosedürde değişebildiği için
   * (Sonuc / sunucucevap) harf duyarsız okunur.
   */
  sendAuthorityLogin(sicilId: number): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<Record<string, unknown>[]>('Dynamic', {
        point: 'loginsendcampus',
        islemtipi: 'd',
        xsicilid: sicilId,
      })
      .pipe(
        map((response) => {
          const row = unwrapResponse(response);
          const pick = (name: string): unknown => {
            const key = row ? Object.keys(row).find((k) => k.toLowerCase() === name) : undefined;
            return key && row ? row[key] : undefined;
          };
          return {
            sonuc: row ? Number(pick('sonuc')) : -1,
            sunucuCevap: row ? String(pick('sunucucevap') ?? '') : 'SCHOOL_BUS.MSG_NO_RESPONSE',
          };
        }),
      );
  }

  getAuthorityAssignments(): Observable<AuthorityAssignment[]> {
    return this.api
      .callEndpoint<AuthorityServisRow[]>('Dynamic', { point: 'yetkiliservis', islemtipi: 's' })
      .pipe(
        map((rows) =>
          (rows || []).map((row) => ({
            id: row.Id,
            authoritySicilId: row.YetkiliSicilId,
            authorityName: row.YetkiliAdSoyad,
            servisId: row.ServisId,
            plaka: row.Plaka,
            marka: row.Marka,
            model: row.Model,
            createdDate: row.CreatedDate,
          })),
        ),
      );
  }

  assignAuthorityToBus(
    authoritySicilId: number,
    servisId: number,
  ): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<DBInsertResult[]>('Dynamic', {
        point: 'yetkiliservis',
        islemtipi: 'i',
        YetkiliSicilId: authoritySicilId,
        ServisId: servisId,
      })
      .pipe(map(this.mapStandardResponse));
  }

  removeAuthorityAssignment(id: number): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<DBInsertResult[]>('Dynamic', { point: 'yetkiliservis', islemtipi: 'd', Id: id })
      .pipe(map(this.mapStandardResponse));
  }

  private mapStandardResponse = (
    response: DBInsertResult[] | null,
  ): { sonuc: number; sunucuCevap: string } => {
    const unwrapped = unwrapResponse(response);
    return {
      sonuc: unwrapped ? Number(unwrapped.Sonuc) : -1,
      sunucuCevap: unwrapped ? String(unwrapped.SunucuCevap) : 'SCHOOL_BUS.MSG_NO_RESPONSE',
    };
  };
}
