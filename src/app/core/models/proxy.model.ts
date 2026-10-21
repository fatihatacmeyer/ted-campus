export enum ProxyApprovalStatus {
  Rejected = -1,
  Pending = 0,
  Approved = 1,
}

export interface GuardianProxy {
  id: number;
  veliSicilId: number;
  veliAdSoyad: string;
  ogrenciSicilId: number;
  ogrenciAdSoyad: string;
  ogrenciKampus: string | null;
  ogrenciSinif: string | null;
  vekilAdSoyad: string;
  vekilTelefon: string;
  vekilTC: string;
  yakinlik: string;
  basTarih: string;
  bitTarih: string;
  isActive: boolean;
  onayDurumu: ProxyApprovalStatus;
  onayDurumuMetni: string;
  createdDate: string;
}
