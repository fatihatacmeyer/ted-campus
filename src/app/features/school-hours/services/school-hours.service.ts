import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHelperService } from '../../../core/services/api-helper.service';
import { SchoolHours, DBResult } from '../models/school-hours.model';
import { unwrapResponse } from '../../../shared/utils/response.utils';
import { TypesService, DropdownItem } from '../../persons/services/types.service';

@Injectable({
  providedIn: 'root',
})
export class SchoolHoursService {
  private api = inject(ApiHelperService);
  private typesService = inject(TypesService);

  private readonly days = [
    'Pazartesi',
    'Sali',
    'Carsamba',
    'Persembe',
    'Cuma',
    'Cumartesi',
    'Pazar',
  ];
  private readonly timeTypes = ['Bas', 'Bit', 'EtutluBas', 'EtutluBit'];

  getSchoolHours(
    CampusId: number,
    SinifId: number | string,
    SicilId?: number,
  ): Observable<SchoolHours[]> {
    const payload: any = {
      point: 'CikisSaatleriCampus',
      islemtipi: 's',
      CampusId: CampusId,
      SinifId: SinifId,
    };

    if (SicilId != null) {
      payload.SicilId = SicilId;
    }

    return this.api
      .callEndpoint<SchoolHours[] | { islemsonuc?: string | number; sunucucevap?: string }>(
        'Dynamic',
        payload,
      )
      .pipe(
        map((raw) => {
          if (!Array.isArray(raw)) {
            return [];
          }
          raw.forEach((row: any) => {
            this.days.forEach((day) => {
              this.timeTypes.forEach((t) => {
                const val = row[day + t];
                if (val && typeof val === 'string' && val.length >= 5) {
                  row[day + t] = val.substring(0, 5);
                }
              });
            });
          });
          return raw;
        }),
      );
  }

  getCampuses(): Observable<DropdownItem[]> {
    return this.typesService
      .getDropdownList('cbo_firma')
      .pipe(map((items) => (items || []).filter((i) => i.id !== 0)));
  }

  getClasses(): Observable<DropdownItem[]> {
    return this.typesService
      .getDropdownList('cbo_bolum')
      .pipe(map((items) => (items || []).filter((i) => i.id > 10)));
  }

  getFilterData(): Observable<{ campuses: DropdownItem[]; classes: DropdownItem[] }> {
    return forkJoin({
      campuses: this.getCampuses(),
      classes: this.getClasses(),
    });
  }

  updateSchoolHours(data: SchoolHours): Observable<{ sonuc: number; sunucuCevap: string }> {
    return this.api
      .callEndpoint<DBResult[]>('Dynamic', {
        point: 'CikisSaatleriCampus',
        islemtipi: 'u',
        Id: data.Id,
        SinifSeviyesi: data.SinifSeviyesi,
        Aciklama: data.Aciklama,

        PazartesiBas: data.PazartesiBas,
        PazartesiBit: data.PazartesiBit,
        PazartesiEtutluBas: data.PazartesiEtutluBas,
        PazartesiEtutluBit: data.PazartesiEtutluBit,
        SaliBas: data.SaliBas,
        SaliBit: data.SaliBit,
        SaliEtutluBas: data.SaliEtutluBas,
        SaliEtutluBit: data.SaliEtutluBit,
        CarsambaBas: data.CarsambaBas,
        CarsambaBit: data.CarsambaBit,
        CarsambaEtutluBas: data.CarsambaEtutluBas,
        CarsambaEtutluBit: data.CarsambaEtutluBit,
        PersembeBas: data.PersembeBas,
        PersembeBit: data.PersembeBit,
        PersembeEtutluBas: data.PersembeEtutluBas,
        PersembeEtutluBit: data.PersembeEtutluBit,
        CumaBas: data.CumaBas,
        CumaBit: data.CumaBit,
        CumaEtutluBas: data.CumaEtutluBas,
        CumaEtutluBit: data.CumaEtutluBit,
        CumartesiBas: data.CumartesiBas,
        CumartesiBit: data.CumartesiBit,
        CumartesiEtutluBas: data.CumartesiEtutluBas,
        CumartesiEtutluBit: data.CumartesiEtutluBit,
        PazarBas: data.PazarBas,
        PazarBit: data.PazarBit,
        PazarEtutluBas: data.PazarEtutluBas,
        PazarEtutluBit: data.PazarEtutluBit,

        // Yeni Toplu Format Alanı
        GunlerVeSiciller: data.GunlerVeSiciller !== undefined ? data.GunlerVeSiciller : null,
      })
      .pipe(
        map((response) => {
          const unwrapped = unwrapResponse(response) as any;
          const sonucVal =
            unwrapped?.Sonuc ?? unwrapped?.sonuc ?? unwrapped?.islemsonuc ?? unwrapped?.islemSonuc;
          const sunucuCevapVal =
            unwrapped?.SunucuCevap ??
            unwrapped?.sunucuCevap ??
            unwrapped?.sunucucevap ??
            unwrapped?.mesaj ??
            unwrapped?.aciklama;
          return {
            sonuc: sonucVal != null ? Number(sonucVal) : 1,
            sunucuCevap: sunucuCevapVal ? String(sunucuCevapVal) : 'Saatler başarıyla güncellendi.',
          };
        }),
      );
  }
}
