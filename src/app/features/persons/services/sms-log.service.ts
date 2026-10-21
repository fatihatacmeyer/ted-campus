import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHelperService } from '../../../core/services/api-helper.service';
import { SmsLog, SmsLogQuery } from '../models/sms-log.model';

interface SmsLogRow {
  Id: number;
  SicilId: number | null;
  Telefon: string | null;
  Durum: number;
  DurumAciklama: string | null;
  RetryCount: number | null;
  CreatedAt: string | null;
  SentAt: string | null;
  GatewayCevap: string | null;
  TimerId: string | null;
}

interface SmsLogErrorRow {
  Sonuc: number | string;
  SunucuCevap: string;
}

export class SmsLogError extends Error {}

@Injectable({
  providedIn: 'root',
})
export class SmsLogService {
  private api = inject(ApiHelperService);

  getSmsLog(query: SmsLogQuery): Observable<SmsLog[]> {
    const hasSicil = !!query.sicilId;
    const hasVekil = !!query.vekilCampusId;
    if (hasSicil === hasVekil) {
      return throwError(() => new SmsLogError('sicilId ya da vekilCampusId gereklidir'));
    }

    return this.api
      .callEndpoint<(SmsLogRow | SmsLogErrorRow)[]>('Dynamic', {
        point: 'smskuyrukcampus',
        islemtipi: 's',
        SicilId: hasSicil ? query.sicilId : '',
        VekilCampusId: hasVekil ? query.vekilCampusId : '',
        Durum: query.durum ?? '',
        Baslangic: query.baslangic ?? '',
        Bitis: query.bitis ?? '',
        Adet: query.adet ?? '',
      })
      .pipe(
        map((rows) => {
          const list = rows || [];
          const first = list[0] as SmsLogErrorRow | undefined;
          if (first && 'Sonuc' in first && Number(first.Sonuc) < 0) {
            throw new SmsLogError(String(first.SunucuCevap ?? ''));
          }
          return (list as SmsLogRow[]).map((row) => ({
            id: row.Id,
            sicilId: row.SicilId ?? null,
            telefon: row.Telefon ?? '',
            durum: row.Durum,
            durumAciklama: row.DurumAciklama ?? '',
            retryCount: row.RetryCount ?? 0,
            createdAt: row.CreatedAt ?? null,
            sentAt: row.SentAt ?? null,
            gatewayCevap: row.GatewayCevap ?? null,
            timerId: row.TimerId ?? null,
          }));
        }),
      );
  }
}
