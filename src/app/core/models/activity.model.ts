export interface ActivityInterface {
  id: number;
  name: string;
  startDate: Date | string;
  endDate: Date | string;
  activityType: string;
  isPaid: boolean;
  fee: number | null;
  status: string;
  requestStartDate: Date | string;
  requestEndDate: Date | string;
  isParentRequired: boolean;
  description: string;
  maxStudentCount: number;
  studentParentCount: number;
  maxGuestPerParent?: number;
  transportation: string;
  educationLevel?: string;
  campus?: string;
  campusId?: number;
  eventManager: string;
  sorumluSicilId?: number;
  yasSiniri?: string;
  sinifId?: string;
  oKod1: string;
  oKod2: string;
  oKod3: string;
  oKod4: string;
  oKod5: string;
  xSicilID: number;
  createdAt: Date | string;
  isPrivate: boolean;
  classroom: string;
}

export interface ActivityApprovalStats {
  etkinlikId: number;
  bekleyen: number;
  onaylanan: number;
  reddedilen: number;
  toplam: number;
}

export interface ActivityParticipant {
  id: number;
  ogrenciSicilId: number;
  ogrenci: string;
  sinif: string;
  veliSicilId: number;
  veli: string;
  telefon: string;
  durum: 'Bekleyen' | 'Onaylanan' | 'Reddedilen';
}
