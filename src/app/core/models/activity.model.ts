export interface ActivityInterface {
  id: number;
  name: string;
  startDate: Date | string;
  endDate: Date | string;
  activityType: string; // etkinlik türü/ pilav günü, mezuniyet gecesi, ankara gezisi vs
  isPaid: boolean;
  fee: number | null; // ödenecek ücret eğer isPaid 1 ise
  status: string;
  requestStartDate: Date | string; // etkinlik için başvurulabilecek ilk tarih
  requestEndDate: Date | string; // etkinlik için başvurulabilecek son tarih
  isParentRequired: boolean; // veli getirmek zorunlu mu
  description: string;
  maxStudentCount: number; // etkinliğe katılabilecek maksimum öğrenci sayısı
  studentParentCount: number; // öğrencinin getirebileceği veli sayısı
  maxGuestPerParent?: number; // veli başına maksimum misafir sayısı (VeliBasinaMisafirSayisi)
  transportation: string;
  educationLevel?: string; // eğitim düzeyi (cbo_direktorluk lookup'ından, ekranda ad saklanır)
  campus?: string; // kampüs bilgisi (cbo_firma lookup'ından, ekranda ad saklanır)
  campusId?: number; // kampüs id'si (CampusId) — _s prosedürü döndüğünden beri edit'te korunur
  eventManager: string;
  sorumluSicilId?: number; // etkinlik sorumlusunun sicil id'si (SorumluSicilId)
  yasSiniri?: string; // yaş sınırı (YasSiniri)
  sinifId?: string; // ';' ile ayrılmış sınıf id listesi (SinifId)
  oKod1: string;
  oKod2: string;
  oKod3: string;
  oKod4: string;
  oKod5: string;
  xSicilID: number; // etkinliği oluşturan
  createdAt: Date | string;
  isPrivate: boolean; // sadece belli sınıfları seçebilmek için
  classroom: string; // etkinliğe katılacak sınıflar
}

/** sp_EtkinlikOnayCampus'ten dönen etkinlik onay istatistikleri. */
export interface ActivityApprovalStats {
  etkinlikId: number;
  bekleyen: number;
  onaylanan: number;
  reddedilen: number;
  toplam: number;
}

/** sp_EtkinlikKatilimcilari_s'ten dönen katılımcı kaydı. */
export interface ActivityParticipant {
  id: number; // SiraNo
  ogrenciSicilId: number;
  ogrenci: string; // Ogrenci (ad soyad)
  sinif: string;
  veliSicilId: number;
  veli: string; // Veli (ad soyad)
  telefon: string;
  durum: 'Bekleyen' | 'Onaylanan' | 'Reddedilen'; // DurumMetni
}
