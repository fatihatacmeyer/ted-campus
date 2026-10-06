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

export type ServisYonu = 1 | 2;

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
  yon: ServisYonu;
  yonAciklama: string;
}

export interface StudentAssignmentFilter {
  id?: number;
  ogrenciSicilId?: number;
  servisId?: number;
  yon?: number;
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

/** sp_serviskullanicilarcampus_s: servis yetkilileri (UserDef = YETKILI, çıkış yapmamış). */
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
