import '@angular/compiler';
import { Injector } from '@angular/core';
import { lastValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { ApiHelperService } from '../../../core/services/api-helper.service';
import { SmsLogStatus } from '../models/sms-log.model';
import { SmsLogError, SmsLogService } from './sms-log.service';

function setup(response: unknown) {
  const calls: Record<string, unknown>[] = [];
  const fakeApi = {
    callEndpoint: (_endpoint: string, params: Record<string, unknown>) => {
      calls.push(params);
      return of(response);
    },
  };
  const injector = Injector.create({
    providers: [
      { provide: ApiHelperService, useValue: fakeApi },
      { provide: SmsLogService, useClass: SmsLogService },
    ],
  });
  return { service: injector.get(SmsLogService), calls };
}

describe('SmsLogService', () => {
  it('sicil kişisi için yalnızca SicilId gönderir ve satırları eşler', async () => {
    const { service, calls } = setup([
      {
        Id: 7,
        SicilId: 42,
        Telefon: '532 *** ** 67',
        Durum: 2,
        DurumAciklama: 'Gönderildi',
        RetryCount: 1,
        CreatedAt: '2026-10-20T10:15:00',
        SentAt: '2026-10-20T10:15:05',
        GatewayCevap: 'OK',
        TimerId: null,
      },
    ]);

    const rows = await lastValueFrom(
      service.getSmsLog({ sicilId: 42, durum: SmsLogStatus.Gonderildi, baslangic: '2026-10-01' }),
    );

    expect(calls[0]).toMatchObject({
      point: 'smskuyrukcampus',
      islemtipi: 's',
      SicilId: 42,
      VekilCampusId: '',
      Durum: 2,
      Baslangic: '2026-10-01',
      Bitis: '',
    });
    expect(rows).toEqual([
      {
        id: 7,
        sicilId: 42,
        telefon: '532 *** ** 67',
        durum: SmsLogStatus.Gonderildi,
        durumAciklama: 'Gönderildi',
        retryCount: 1,
        createdAt: '2026-10-20T10:15:00',
        sentAt: '2026-10-20T10:15:05',
        gatewayCevap: 'OK',
        timerId: null,
      },
    ]);
  });

  it('vekil için yalnızca VekilCampusId gönderir', async () => {
    const { service, calls } = setup([]);
    const rows = await lastValueFrom(service.getSmsLog({ vekilCampusId: 5 }));
    expect(calls[0]).toMatchObject({ SicilId: '', VekilCampusId: 5, Durum: '' });
    expect(rows).toEqual([]);
  });

  it('prosedür Sonuc = -1 dönerse SunucuCevap ile hata verir', async () => {
    const { service } = setup([{ Sonuc: -1, SunucuCevap: 'Bu kişi için yetkiniz yok' }]);
    await expect(lastValueFrom(service.getSmsLog({ sicilId: 1 }))).rejects.toThrow(
      new SmsLogError('Bu kişi için yetkiniz yok'),
    );
  });

  it('kimlik yoksa ya da ikisi birden verilirse istek atmaz', async () => {
    const { service, calls } = setup([]);
    await expect(lastValueFrom(service.getSmsLog({}))).rejects.toBeInstanceOf(SmsLogError);
    await expect(
      lastValueFrom(service.getSmsLog({ sicilId: 1, vekilCampusId: 2 })),
    ).rejects.toBeInstanceOf(SmsLogError);
    expect(calls).toHaveLength(0);
  });
});
