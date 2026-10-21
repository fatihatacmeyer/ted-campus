export enum SmsLogStatus {
  Bekliyor = 0,
  Gonderiliyor = 1,
  Gonderildi = 2,
  Basarisiz = 3,
}

export interface SmsLog {
  id: number;
  sicilId: number | null;
  telefon: string;
  durum: SmsLogStatus;
  durumAciklama: string;
  retryCount: number;
  createdAt: string | null;
  sentAt: string | null;
  gatewayCevap: string | null;
  timerId: string | null;
}

export interface SmsLogQuery {
  sicilId?: number | null;
  vekilCampusId?: number | null;
  durum?: SmsLogStatus | null;
  baslangic?: string | null;
  bitis?: string | null;
  adet?: number | null;
}
