import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHelperService } from '../../../core/services/api-helper.service';
import { unwrapResponse } from '../../../shared/utils/response.utils';
import {
  Bus,
  ServisYonu,
  StudentAssignment,
  StudentAssignmentFilter,
  BusDashboardStats,
  AuthorityAssignment,
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

@Injectable({
  providedIn: 'root',
})
export class SchoolBusService {
  private api = inject(ApiHelperService);

  getDashboardStats(): Observable<BusDashboardStats> {
    return this.api
      .callEndpoint<any[]>('Dynamic', { point: 'ServisDashboard', islemtipi: 's' })
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
            yon: row.Yon as ServisYonu,
            yonAciklama: row.YonAciklama,
          })),
        ),
      );
  }

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
      sunucuCevap: unwrapped ? String(unwrapped.SunucuCevap) : 'Sunucudan yanıt alınamadı.',
    };
  };
}
