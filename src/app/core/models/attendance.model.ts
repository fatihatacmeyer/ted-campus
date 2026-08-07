/** Attendance list type: 0=general, 4=late arrivals, 5=early leavers, 6=on leave. */
export type AttendanceListType = 0 | 4 | 5 | 6;

/** Personnel attendance row returned from sp_pdks_{s} (backend → UI model). */
export interface AttendanceRow {
  sicilId: number;
  sicilNo: string;
  ad: string;
  soyad: string;
  adSoyad: string; // ad + ' ' + soyad
  bolumAd: string;
  pozisyonAd: string;
  mesaiTarih: string; // yyyy-MM-dd
  giris: string | null; // yyyy-MM-ddTHH:mm:ss veya null
  cikis: string | null; // yyyy-MM-ddTHH:mm:ss veya null
  girisId: number;
  cikisId: number;
  elleGiris: number; // 2=manuel giriş, >2=GPS
  elleCikis: number;
  gecKalma: number; // dakika; >0 => geç gelen
  erkenCikma: number; // dakika; >0 => erken çıkan
  mesaiBas: string; // HH:mm
  mesaiBit: string; // HH:mm
  mesaiSuresi: number; // dakika
  normalMesai: number;
  araSure: number;
  fazlaMesai: number;
  izinSuresi: number; // dakika; >0 => o gün izinli
  yillikIzinSuresi: number;
  eksikMesai: number;
  mesaiAciklama: string;
  izinAciklama: string;
  kayitYetki: number;
  onayMiPdks: boolean;
}

/** Leave type (cbo_izintipleri lookup). */
export interface LeaveType {
  id: number;
  ad: string;
  ucretli: boolean;
  gunlukIzin: boolean;
  saatlikIzin: boolean;
}

/** Personnel annual leave balance summary. */
export interface LeaveBalance {
  yillikIzinHakTarihi: string;
  kidem: number;
  hak: number;
  kullanilanYillikIzin: number;
  izinDevir: number;
  kalan: number;
}

/** New leave request (payload sent to backend). */
export interface LeaveRequest {
  izinTipId: number;
  sicilId?: number; // talep edilen personel (legacy siciller parametresi)
  baslangic: string; // yyyy-MM-dd
  bitis: string; // yyyy-MM-dd
  baslangicSaat: string | null; // HH:mm (saatlik izin)
  bitisSaat: string | null;
  ucretli: boolean;
  saatlik: boolean;
  adres: string;
  aciklama: string;
}

/** Personnel leave request record. */
export interface LeaveRecord {
  id: number;
  izinTipi: string;
  bastarih: string; // yyyy-MM-dd
  bittarih: string;
  ucretli: boolean;
  saatlik: boolean;
  durum: string; // 'Talep' | 'Onaylandı' | 'Reddedildi'
}
