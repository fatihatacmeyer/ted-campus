export type AttendanceListType = 0 | 4 | 5 | 6;

export interface AttendanceRow {
  sicilId: number;
  sicilNo: string;
  ad: string;
  soyad: string;
  adSoyad: string;
  bolumAd: string;
  pozisyonAd: string;
  mesaiTarih: string;
  giris: string | null;
  cikis: string | null;
  girisId: number;
  cikisId: number;
  elleGiris: number;
  elleCikis: number;
  gecKalma: number;
  erkenCikma: number;
  mesaiBas: string;
  mesaiBit: string;
  mesaiSuresi: number;
  normalMesai: number;
  araSure: number;
  fazlaMesai: number;
  izinSuresi: number;
  yillikIzinSuresi: number;
  eksikMesai: number;
  mesaiAciklama: string;
  izinAciklama: string;
  kayitYetki: number;
  onayMiPdks: boolean;
}

export interface LeaveType {
  id: number;
  ad: string;
  ucretli: boolean;
  gunlukIzin: boolean;
  saatlikIzin: boolean;
}

export interface LeaveBalance {
  yillikIzinHakTarihi: string;
  kidem: number;
  hak: number;
  kullanilanYillikIzin: number;
  izinDevir: number;
  kalan: number;
}

export interface LeaveRequest {
  izinTipId: number;
  sicilId?: number;
  baslangic: string;
  bitis: string;
  baslangicSaat: string | null;
  bitisSaat: string | null;
  ucretli: boolean;
  saatlik: boolean;
  adres: string;
  aciklama: string;
}

export interface LeaveRecord {
  id: number;
  izinTipi: string;
  bastarih: string;
  bittarih: string;
  ucretli: boolean;
  saatlik: boolean;
  durum: string;
}

export type StudentAttendanceFilterType = 0 | 1 | 2 | 3;

export interface StudentAttendanceRow {
  sicilId: number;
  sicilNo: string;
  adSoyad: string;
  sinif: string;
  kampus: string;
  egitimDuzeyi: string;
  gelisServisPlaka: string | null;
  donusServisPlaka: string | null;
  tarih: string;
  girisSaati: string | null;
  cikisSaati: string | null;
  gecKalmaSuresiDk: number;
  erkenCikmaSuresiDk: number;
  izinId: number | null;
  izinTipi: string | null;
  izinSaatAraligi: string | null;
  okulSaatleri: string;
}
