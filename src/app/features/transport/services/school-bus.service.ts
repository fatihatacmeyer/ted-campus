import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHelperService } from '../../../core/services/api-helper.service';
import { Bus, ServisYonu, StudentAssignment } from '../pages/school-bus/mock-data';
import { unwrapResponse } from '../../../shared/utils/response.utils';

interface ServisCampusRow {
  Id: number;
  Plaka: string;
  Marka: string;
  Model: string;
  KoltukSayisi: number;
  DoluKoltuk: number;
  BosKoltuk: number;
  Aciklama: string;
  Durum: string;
}

/**
 * sp_ogrenciserviscampus_s'ten dönen ham DB satırı.
 * Kolon adları DB'den geldiği gibi (PascalCase) tutulur; StudentAssignment
 * modeline çevrim getStudentAssignments içinde yapılır.
 */
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

export interface StudentAssignmentFilter {
  id?: number;
  ogrenciSicilId?: number;
  servisId?: number;
  yon?: number;
}

export interface BusDashboardStats {
  totalPassengers: number;
  totalBuses: number;
  activeBuses: number;
  maintenanceBuses: number;
  passiveBuses: number;
}

interface DBInsertResult {
  Sonuc: number | string;
  SunucuCevap: string;
}

@Injectable({
  providedIn: 'root',
})
export class SchoolBusService {
  private api = inject(ApiHelperService);

  getDashboardStats(): Observable<BusDashboardStats> {
    return this.api
      .callEndpoint<any[]>('Dynamic', {
        point: 'ServisDashboard',
        islemtipi: 's',
      })
      .pipe(
        map((rows) => {
          const row = rows && rows.length > 0 ? rows[0] : {};
          return {
            totalPassengers: Number(row.ToplamServisKullanan) || 0,
            totalBuses: Number(row.ToplamArac) || 0,
            activeBuses: Number(row.AktifArac) || 0,
            maintenanceBuses: Number(row.BakimdakiArac) || 0,
            passiveBuses: Number(row.PasifArac) || 0,
          };
        }),
      );
  }

  getBuses(): Observable<Bus[]> {
    return this.api
      .callEndpoint<ServisCampusRow[]>('Dynamic', {
        point: 'serviscampus',
        islemtipi: 's',
      })
      .pipe(
        map((rows) =>
          (rows || []).map((row) => ({
            id: row.Id,
            plate: row.Plaka,
            brand: row.Marka,
            model: row.Model,
            seatCount: row.KoltukSayisi,
            occupiedSeats: row.DoluKoltuk,
            emptySeats: row.BosKoltuk,
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
      .pipe(
        map((response) => {
          const unwrapped = unwrapResponse(response);
          return {
            sonuc: unwrapped ? Number(unwrapped.Sonuc) : -1,
            sunucuCevap: unwrapped ? String(unwrapped.SunucuCevap) : 'Sunucudan yanıt alınamadı.',
          };
        }),
      );
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
      .pipe(
        map((response) => {
          console.log('[updateBus] raw response:', response);
          const unwrapped = unwrapResponse(response);
          console.log('[updateBus] unwrapped:', unwrapped);
          return {
            sonuc: unwrapped ? Number(unwrapped.Sonuc) : -1,
            sunucuCevap: unwrapped ? String(unwrapped.SunucuCevap) : 'Sunucudan yanıt alınamadı.',
          };
        }),
      );
  }

  deleteBus(id: number): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<DBInsertResult[]>('Dynamic', {
        point: 'serviscampus',
        islemtipi: 'd',
        Id: id,
      })
      .pipe(
        map((response) => {
          console.log('[deleteBus] raw response:', response);
          const unwrapped = unwrapResponse(response);
          console.log('[deleteBus] unwrapped:', unwrapped);
          return {
            sonuc: unwrapped ? Number(unwrapped.Sonuc) : -1,
            sunucuCevap: unwrapped ? String(unwrapped.SunucuCevap) : 'Sunucudan yanıt alınamadı.',
          };
        }),
      );
  }

  // ════════════════════════════════════════════════════════
  //  ÖĞRENCİ SERVİS ATAMALARI (sp_ogrenciserviscampus_*)
  //  Atama artık bağımsız bir varlık değil — doğrudan bir araca
  //  (ServisId) bağlı olarak yönetilir.
  // ════════════════════════════════════════════════════════

  /**
   * point=ogrenciserviscampus & islemtipi=s -> sp_ogrenciserviscampus_s
   * Filtre verilmezse tüm atamalar döner; servisId verilirse sadece o
   * araca atanmış öğrenciler döner (araç bazlı atama ekranı bunu kullanır).
   */
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
            yon: row.Yon as ServisYonu,
            yonAciklama: row.YonAciklama,
          })),
        ),
      );
  }

  /** point=ogrenciserviscampus & islemtipi=i -> sp_ogrenciserviscampus_i */
  assignStudentToBus(
    ogrenciSicilId: number,
    servisId: number,
    yon: ServisYonu,
  ): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<DBInsertResult[]>('Dynamic', {
        point: 'ogrenciserviscampus',
        islemtipi: 'i',
        OgrenciSicilId: ogrenciSicilId,
        ServisId: servisId,
        Yon: yon,
      })
      .pipe(
        map((response) => {
          const unwrapped = unwrapResponse(response);
          return {
            sonuc: unwrapped ? Number(unwrapped.Sonuc) : -1,
            sunucuCevap: unwrapped ? String(unwrapped.SunucuCevap) : 'Sunucudan yanıt alınamadı.',
          };
        }),
      );
  }

  /** point=ogrenciserviscampus & islemtipi=d -> sp_ogrenciserviscampus_d */
  removeStudentAssignment(id: number): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<DBInsertResult[]>('Dynamic', {
        point: 'ogrenciserviscampus',
        islemtipi: 'd',
        Id: id,
      })
      .pipe(
        map((response) => {
          const unwrapped = unwrapResponse(response);
          return {
            sonuc: unwrapped ? Number(unwrapped.Sonuc) : -1,
            sunucuCevap: unwrapped ? String(unwrapped.SunucuCevap) : 'Sunucudan yanıt alınamadı.',
          };
        }),
      );
  }

  /** point=ogrenciserviscampus & islemtipi=i -> sp_ogrenciserviscampus_i */
  // assignStudentToBus(
  //   ogrenciSicilId: number,
  //   servisId: number,
  //   yon: ServisYonu,
  // ): Observable<{ sonuc: number; sunucuCevap: string }> {
  //   return this.api
  //     .callEndpoint<DBInsertResult[]>('Dynamic', {
  //       point: 'ogrenciserviscampus',
  //       islemtipi: 'i',
  //       OgrenciSicilId: ogrenciSicilId,
  //       servisid: servisId,
  //       Yon: yon,
  //     })
  //     .pipe(
  //       map((response) => {
  //         const unwrapped = unwrapResponse(response);
  //         return {
  //           sonuc: unwrapped ? Number(unwrapped.Sonuc) : -1,
  //           sunucuCevap: unwrapped ? String(unwrapped.SunucuCevap) : 'Sunucudan yanıt alınamadı.',
  //         };
  //       }),
  //     );
  // }

  // /** point=ogrenciserviscampus & islemtipi=d -> sp_ogrenciserviscampus_d */
  // removeStudentAssignment(id: number): Observable<{ sonuc: number; sunucuCevap: string }> {
  //   return this.api
  //     .callEndpoint<DBInsertResult[]>('Dynamic', {
  //       point: 'ogrenciserviscampus',
  //       islemtipi: 'd',
  //       Id: id,
  //     })
  //     .pipe(
  //       map((response) => {
  //         const unwrapped = unwrapResponse(response);
  //         return {
  //           sonuc: unwrapped ? Number(unwrapped.Sonuc) : -1,
  //           sunucuCevap: unwrapped ? String(unwrapped.SunucuCevap) : 'Sunucudan yanıt alınamadı.',
  //         };
  //       }),
  //     );
  // }
}
