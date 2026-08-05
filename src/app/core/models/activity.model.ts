export interface ActivityInterface {
  id: number; // etkinlik id'si
  name: string; // etkinlik adı
  startDate: Date | string; // etkinlik başlangıç tarihi
  endDate: Date | string; // etkinlik bitiş tarihi
  activityType: string; // etkinlik türü/ pilav günü, mezuniyet gecesi, ankara gezisi vs
  isPaid: boolean; // ücretli / ücretsiz durumu
  fee: number | null; // ödenecek ücret eğer isPaid 1 ise
  status: string; // durum / aktif pasif // boolean da olabilir
  requestStartDate: Date | string; // etkinlik için başvurulabilecek ilk tarih
  requestEndDate: Date | string; // etkinlik için başvurulabilecek son tarih
  isParentRequired: boolean; // veli getirmek zorunlu mu
  description: string; // açıklama
  maxStudentCount: number; // etkinliğe katılabilecek maksimum öğrenci sayısı
  studentParentCount: number; // öğrencinin getirebileceği veli sayısı
  transportation: string; // ulaşım
  educationLevel?: string; // eğitim düzeyi (cbo_direktorluk lookup'ından, ekranda ad saklanır)
  eventManager: string; // etkinlik yöneticisi
  oKod1: string; // ekstra alanlar 1
  oKod2: string;
  oKod3: string;
  oKod4: string;
  oKod5: string; // estra alanlar 5, bitiş
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
