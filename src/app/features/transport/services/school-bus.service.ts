import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHelperService } from '../../../core/services/api-helper.service';
import { Bus } from '../pages/school-bus/mock-data';
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
}
