/** SmsKuyrukCampus.Status değerleri (sp_smskuyrukcampus_s). */
export enum SmsLogStatus {
  Bekliyor = 0,
  Gonderiliyor = 1,
  Gonderildi = 2,
  Basarisiz = 3,
}

/** Bir kişinin SMS kuyruğu kaydı. Mesaj içeriği güvenlik gereği hiç dönmez, telefon maskelidir. */
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

/** Tam biri zorunlu: sicilId (öğrenci / veli / yetkili) ya da vekilCampusId (vekil). */
export interface SmsLogQuery {
  sicilId?: number | null;
  vekilCampusId?: number | null;
  durum?: SmsLogStatus | null;
  /** 'yyyy-MM-dd' */
  baslangic?: string | null;
  /** 'yyyy-MM-dd' (dahil) */
  bitis?: string | null;
  adet?: number | null;
}
