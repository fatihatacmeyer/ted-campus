import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHelperService } from '../../../core/services/api-helper.service';
import { SchoolHours, DBResult } from '../models/school-hours.model';
import { TIME_FIELD_SUFFIXES, WEEKDAYS, timeField } from '../models/weekday.model';
import { unwrapResponse } from '../../../shared/utils/response.utils';
import { TypesService, DropdownItem } from '../../persons/services/types.service';

@Injectable({
  providedIn: 'root',
})
export class SchoolHoursService {
  private api = inject(ApiHelperService);
  private typesService = inject(TypesService);

  getSchoolHours(
    CampusId: number,
    SinifId: number | string,
    SicilId?: number,
  ): Observable<SchoolHours[]> {
    const payload: Record<string, string | number | null | undefined> = {
      point: 'CikisSaatleriCampus',
      islemtipi: 's',
      CampusId,
      SinifId,
    };

    if (SicilId != null) {
      payload['SicilId'] = SicilId;
    }

    return this.api
      .callEndpoint<SchoolHours[] | { islemsonuc?: string | number; sunucucevap?: string }>(
        'Dynamic',
        payload,
      )
      .pipe(map((raw) => (Array.isArray(raw) ? raw.map(truncateTimeFields) : [])));
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
        ...collectDayTimeFields(data),
        // Yeni Toplu Format Alanı
        GunlerVeSiciller: data.GunlerVeSiciller ?? null,
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

/** Backend bazen "HH:MM:SS" döndürebiliyor; görüntüde/inputlarda hep "HH:MM" kullanıyoruz. */
function truncateTimeFields(row: SchoolHours): SchoolHours {
  const copy = { ...row } as unknown as Record<string, unknown>;
  for (const day of WEEKDAYS) {
    for (const suffix of TIME_FIELD_SUFFIXES) {
      const field = timeField(day.key, suffix);
      const val = copy[field];
      if (typeof val === 'string' && val.length >= 5) {
        copy[field] = val.substring(0, 5);
      }
    }
  }
  return copy as unknown as SchoolHours;
}

/** 28 satırlık elle yazılmış alan listesi yerine WEEKDAYS üzerinden üretilir. */
function collectDayTimeFields(data: SchoolHours): Record<string, string | undefined> {
  const fields: Record<string, string | undefined> = {};
  for (const day of WEEKDAYS) {
    for (const suffix of TIME_FIELD_SUFFIXES) {
      const field = timeField(day.key, suffix);
      fields[field] = (data as unknown as Record<string, unknown>)[field] as string | undefined;
    }
  }
  return fields;
}
