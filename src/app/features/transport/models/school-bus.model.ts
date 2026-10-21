export interface Bus {
  id: number;
  plate: string;
  brand: string;
  model: string;
  seatCount: number;
  doluKoltukGidis: number;
  bosKoltukGidis: number;
  doluKoltukDonus: number;
  bosKoltukDonus: number;
  description: string;
  status: string;
}

export type BusDirection = 1 | 2;

export interface StudentAssignment {
  id: number;
  ogrenciSicilId: number;
  ogrenciAdSoyad: string;
  sinif: string | null;
  kampus: string | null;
  servisId: number;
  plaka: string;
  marka: string;
  model: string;
  yon: BusDirection;
  yonAciklama: string;
}

export interface StudentAssignmentFilter {
  id?: number;
  ogrenciSicilId?: number;
  servisId?: number;
  yon?: number;
}

export interface StudentBusPlan {
  id: number;
  ogrenciSicilId: number;
  ogrenciAdSoyad: string;
  sinif: string | null;
  kampus: string | null;
  servisId: number | null;
  plaka: string | null;
  servisKullanmiyor: boolean;
  yon: BusDirection;
  yonAciklama: string;
  tekrarTuru: string;
  gunAciklama: string;
  baslangicTarih: string | null;
  bitisTarih: string | null;
  tarih: string | null;
  haftaGunu: number | null;
  baslangicIso: string | null;
  bitisIso: string | null;
  aciklama: string | null;
  isActive: boolean;
  olusturanAdSoyad: string | null;
  olusturmaTarihi: string | null;
  guncelleyenAdSoyad: string | null;
  guncellemeTarihi: string | null;
}

export interface StudentBusPlanInput {
  servisId: number | null;
  yon: BusDirection[];
  tarih: string | null;
  haftaGunu: number[];
  baslangicTarih: string | null;
  bitisTarih: string | null;
  aciklama: string | null;
  isActive?: boolean;
}

export interface BusDashboardStats {
  totalPassengers: number;
  totalBuses: number;
  activeBuses: number;
  maintenanceBuses: number;
  passiveBuses: number;
}

export interface AuthorityAssignment {
  id: number;
  authoritySicilId: number;
  authorityName: string;
  servisId: number;
  plaka: string;
  marka: string;
  model: string;
  createdDate: string | null;
}

export interface ServiceAuthority {
  sicilId: number;
  sicilNo: string;
  adSoyad: string;
  cepTelefon: string | null;
  email: string | null;
}

export interface DBInsertResult {
  Sonuc: number | string;
  SunucuCevap: string;
}
