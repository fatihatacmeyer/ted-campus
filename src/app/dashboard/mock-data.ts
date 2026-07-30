// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface PersonInfo {
  adSoyad: string;
  sinif?: string;
  bolum?: string;
  pozisyon?: string;
  durum?: string;
}

export interface TransactionRecord {
  id: number;
  islem: string;
  adSoyad: string;
  terminal: string;
  zaman: string;
  sonuc: string;
}

export interface EarlyLeavingStudent extends PersonInfo {
  cikisSaati: string;
  beklenenSaati: string;
}

export interface LatePerson extends PersonInfo {
  gelisSaati: string;
  beklenenSaati: string;
}

export interface EventAttendee extends PersonInfo {
  etkinlikAdi: string;
}

export interface DashboardCard {
  title: string;
  count: number;
  icon: string;
  color: string;
  details: PersonInfo[] | TransactionRecord[];
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const teachers: PersonInfo[] = [
  { adSoyad: 'Ahmet Yılmaz', bolum: 'Matematik', pozisyon: 'Öğretmen', durum: 'İçeride' },
  { adSoyad: 'Fatma Demir', bolum: 'Fen Bilimleri', pozisyon: 'Öğretmen', durum: 'İçeride' },
  { adSoyad: 'Mehmet Kaya', bolum: 'Türkçe', pozisyon: 'Öğretmen', durum: 'İçeride' },
  { adSoyad: 'Elif Çelik', bolum: 'İngilizce', pozisyon: 'Öğretmen', durum: 'İçeride' },
  { adSoyad: 'Ayşe Korkmaz', bolum: 'Sosyal Bilgiler', pozisyon: 'Öğretmen', durum: 'İçeride' },
  { adSoyad: 'Ali Özdemir', bolum: 'Bilişim Teknolojileri', pozisyon: 'Öğretmen', durum: 'Dışarıda' },
  { adSoyad: 'Zeynep Arslan', bolum: 'Görsel Sanatlar', pozisyon: 'Öğretmen', durum: 'İçeride' },
  { adSoyad: 'Hasan Çetin', bolum: 'Beden Eğitimi', pozisyon: 'Öğretmen', durum: 'İçeride' },
  { adSoyad: 'Merve Yıldırım', bolum: 'Müzik', pozisyon: 'Öğretmen', durum: 'İçeride' },
  { adSoyad: 'Burak Şahin', bolum: 'Fizik', pozisyon: 'Öğretmen', durum: 'Dışarıda' },
  { adSoyad: 'Selin Koç', bolum: 'Kimya', pozisyon: 'Öğretmen', durum: 'İçeride' },
  { adSoyad: 'Emre Aydın', bolum: 'Biyoloji', pozisyon: 'Öğretmen', durum: 'İçeride' },
  { adSoyad: 'Gülşen Polat', bolum: 'Rehberlik', pozisyon: 'Öğretmen', durum: 'İçeride' },
  { adSoyad: 'Kemal Taş', bolum: 'Tarih', pozisyon: 'Öğretmen', durum: 'Dışarıda' },
  { adSoyad: 'Derya Bulut', bolum: 'Coğrafya', pozisyon: 'Öğretmen', durum: 'İçeride' },
];

const insideStudents: PersonInfo[] = [
  { adSoyad: 'Enes Yavuz', sinif: '9-A', durum: 'İçeride' },
  { adSoyad: 'Buse Kara', sinif: '10-B', durum: 'İçeride' },
  { adSoyad: 'Oğuz Aksoy', sinif: '11-A', durum: 'İçeride' },
  { adSoyad: 'Gamze Erdem', sinif: '9-C', durum: 'İçeride' },
  { adSoyad: 'Tuncay Güneş', sinif: '12-A', durum: 'İçeride' },
  { adSoyad: 'Seda Bozkurt', sinif: '10-A', durum: 'İçeride' },
  { adSoyad: 'Furkan Işık', sinif: '11-C', durum: 'İçeride' },
  { adSoyad: 'Melisa Tunç', sinif: '9-B', durum: 'İçeride' },
  { adSoyad: 'Cem Karataş', sinif: '12-B', durum: 'İçeride' },
  { adSoyad: 'İrem Demirci', sinif: '10-C', durum: 'İçeride' },
  { adSoyad: 'Yusuf Arı', sinif: '11-B', durum: 'İçeride' },
  { adSoyad: 'Ece Nurlu', sinif: '9-A', durum: 'İçeride' },
  { adSoyad: 'Barış Özkan', sinif: '12-A', durum: 'İçeride' },
  { adSoyad: 'Dilara Başar', sinif: '10-B', durum: 'İçeride' },
  { adSoyad: 'Murat Şimşek', sinif: '11-A', durum: 'İçeride' },
  { adSoyad: 'Zehra Çınar', sinif: '9-C', durum: 'İçeride' },
  { adSoyad: 'Gökhan Tuncer', sinif: '12-B', durum: 'İçeride' },
  { adSoyad: 'Aslı Kılıç', sinif: '10-A', durum: 'İçeride' },
  { adSoyad: 'Onur Bayrak', sinif: '11-C', durum: 'İçeride' },
  { adSoyad: 'Pınar Acar', sinif: '9-B', durum: 'İçeride' },
  { adSoyad: 'Serkan Güler', sinif: '12-A', durum: 'İçeride' },
  { adSoyad: 'Merve Özal', sinif: '10-C', durum: 'İçeride' },
  { adSoyad: 'Burcu Kurt', sinif: '11-B', durum: 'İçeride' },
  { adSoyad: 'Tolga Aydın', sinif: '9-A', durum: 'İçeride' },
  { adSoyad: 'Handan Er', sinif: '12-B', durum: 'İçeride' },
  { adSoyad: 'Uğur Kocaman', sinif: '10-B', durum: 'İçeride' },
  { adSoyad: 'Nihan Çeliköz', sinif: '11-A', durum: 'İçeride' },
  { adSoyad: 'Kaan Varol', sinif: '9-C', durum: 'İçeride' },
];

const insideTeachers = teachers.filter(t => t.durum === 'İçeride');

const insidePersonnel: PersonInfo[] = [...insideStudents, ...insideTeachers];

const visitors: PersonInfo[] = [
  { adSoyad: 'Mustafa Şen', bolum: 'Dış Firma', durum: 'İçeride' },
  { adSoyad: 'Aylin Koçak', bolum: 'Ziyaretçi', durum: 'İçeride' },
  { adSoyad: 'Volkan Yılmaz', bolum: 'Mühendislik', durum: 'İçeride' },
  { adSoyad: 'Burcu Tanrıverdi', bolum: 'İdari', durum: 'İçeride' },
  { adSoyad: 'Cem Kuzu', bolum: 'Dış Firma', durum: 'Dışarıda' },
  { adSoyad: 'Deniz Acar', bolum: 'Ziyaretçi', durum: 'İçeride' },
  { adSoyad: 'Fırat Doğu', bolum: 'Lojistik', durum: 'İçeride' },
  { adSoyad: 'Gizem Öztürk', bolum: 'Ziyaretçi', durum: 'İçeride' },
  { adSoyad: 'Hakan Balcı', bolum: 'Dış Firma', durum: 'İçeride' },
];

const terminals = ['Giriş Kapısı 1', 'Giriş Kapısı 2', 'Çıkış Kapısı', 'Turnike A', 'Turnike B'];
const islemler = ['Kart Okuma', 'Yüz Tanıma', 'Parmak İzi'];

function generateTransactions(): TransactionRecord[] {
  const records: TransactionRecord[] = [];
  const allPeople = [...insidePersonnel, ...visitors];

  for (let i = 1; i <= 100; i++) {
    const person = allPeople[i % allPeople.length];
    const hour = 7 + Math.floor(Math.random() * 10);
    const minute = Math.floor(Math.random() * 60);
    const isGiris = Math.random() > 0.4;
    const sonucBasari = Math.random() > 0.08;

    records.push({
      id: i,
      islem: islemler[Math.floor(Math.random() * islemler.length)],
      adSoyad: person.adSoyad,
      terminal: terminals[Math.floor(Math.random() * terminals.length)],
      zaman: `2026-07-17 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
      sonuc: sonucBasari ? 'Başarılı' : 'Başarısız',
    });
  }

  return records;
}

const earlyLeavingStudents: EarlyLeavingStudent[] = [
  { adSoyad: 'Enes Yavuz', sinif: '9-A', cikisSaati: '10:15', beklenenSaati: '15:30', durum: 'Erken Ayrıldı' },
  { adSoyad: 'Buse Kara', sinif: '10-B', cikisSaati: '11:30', beklenenSaati: '15:30', durum: 'Erken Ayrıldı' },
  { adSoyad: 'Oğuz Aksoy', sinif: '11-A', cikisSaati: '13:00', beklenenSaati: '15:30', durum: 'Erken Ayrıldı' },
];

const latePeople: LatePerson[] = [
  { adSoyad: 'Ahmet Yılmaz', pozisyon: 'Öğretmen', gelisSaati: '08:25', beklenenSaati: '08:00', durum: 'Geç Geldi' },
  { adSoyad: 'Gamze Erdem', sinif: '9-C', gelisSaati: '08:45', beklenenSaati: '08:30', durum: 'Geç Geldi' },
  { adSoyad: 'Murat Şimşek', sinif: '11-A', gelisSaati: '09:00', beklenenSaati: '08:30', durum: 'Geç Geldi' },
  { adSoyad: 'Kaan Varol', sinif: '9-C', gelisSaati: '08:50', beklenenSaati: '08:30', durum: 'Geç Geldi' },
  { adSoyad: 'Pınar Acar', sinif: '9-B', gelisSaati: '09:10', beklenenSaati: '08:30', durum: 'Geç Geldi' },
];

const totalVisitors: PersonInfo[] = [
  ...visitors,
  { adSoyad: 'Kenan Yalçın', bolum: 'Dış Firma', durum: 'Dışarıda' },
  { adSoyad: 'Sevda Korkmaz', bolum: 'Ziyaretçi', durum: 'Dışarıda' },
  { adSoyad: 'Ömer Kılıç', bolum: 'İdari', durum: 'Dışarıda' },
  { adSoyad: 'Tülin Şahin', bolum: 'Ziyaretçi', durum: 'Dışarıda' },
  { adSoyad: 'Rıdvan Ak', bolum: 'Dış Firma', durum: 'Dışarıda' },
  { adSoyad: 'Nurdan Güneş', bolum: 'Ziyaretçi', durum: 'Dışarıda' },
  { adSoyad: 'İlker Boz', bolum: 'Lojistik', durum: 'Dışarıda' },
  { adSoyad: 'Aysel Turan', bolum: 'İdari', durum: 'Dışarıda' },
  { adSoyad: 'Cengizhan Demir', bolum: 'Dış Firma', durum: 'Dışarıda' },
  { adSoyad: 'Binnur Kaya', bolum: 'Ziyaretçi', durum: 'Dışarıda' },
  { adSoyad: 'Tolga Sarı', bolum: 'Mühendislik', durum: 'Dışarıda' },
  { adSoyad: 'Seçil Erdem', bolum: 'İdari', durum: 'Dışarıda' },
  { adSoyad: 'Yalçın Öz', bolum: 'Dış Firma', durum: 'Dışarıda' },
  { adSoyad: 'Pervin Bulut', bolum: 'Ziyaretçi', durum: 'Dışarıda' },
];

const eventAttendees: EventAttendee[] = [
  { adSoyad: 'Ahmet Yılmaz', pozisyon: 'Öğretmen', etkinlikAdi: 'Yıl Sonu Töreni', durum: 'Katıldı' },
  { adSoyad: 'Fatma Demir', pozisyon: 'Öğretmen', etkinlikAdi: 'Yıl Sonu Töreni', durum: 'Katıldı' },
  { adSoyad: 'Elif Çelik', pozisyon: 'Öğretmen', etkinlikAdi: 'Yıl Sonu Töreni', durum: 'Katıldı' },
  { adSoyad: 'Enes Yavuz', sinif: '9-A', etkinlikAdi: 'Yıl Sonu Töreni', durum: 'Katıldı' },
  { adSoyad: 'Buse Kara', sinif: '10-B', etkinlikAdi: 'Yıl Sonu Töreni', durum: 'Katıldı' },
  { adSoyad: 'Oğuz Aksoy', sinif: '11-A', etkinlikAdi: 'Bilim Fuarı', durum: 'Katıldı' },
  { adSoyad: 'Mustafa Şen', bolum: 'Dış Firma', etkinlikAdi: 'Bilim Fuarı', durum: 'Katıldı' },
  { adSoyad: 'Zeynep Arslan', pozisyon: 'Öğretmen', etkinlikAdi: 'Bilim Fuarı', durum: 'Katıldı' },
  { adSoyad: 'Gamze Erdem', sinif: '9-C', etkinlikAdi: 'Spor Şenliği', durum: 'Katıldı' },
  { adSoyad: 'Hasan Çetin', pozisyon: 'Öğretmen', etkinlikAdi: 'Spor Şenliği', durum: 'Katıldı' },
  { adSoyad: 'Tuncay Güneş', sinif: '12-A', etkinlikAdi: 'Spor Şenliği', durum: 'Katıldı' },
  { adSoyad: 'Seda Bozkurt', sinif: '10-A', etkinlikAdi: 'Spor Şenliği', durum: 'Kayıtlı' },
];

const allTransactions = generateTransactions();

// ─── Public API ─────────────────────────────────────────────────────────────

export function getDashboardMockData(): DashboardCard[] {
  return [
    {
      title: 'İçerideki Personel',
      count: insidePersonnel.length,
      icon: 'pi-users',
      color: '#059669',
      details: insidePersonnel,
    },
    {
      title: 'İçerideki Ziyaretçi',
      count: visitors.filter(v => v.durum === 'İçeride').length,
      icon: 'pi-user',
      color: '#2563eb',
      details: visitors.filter(v => v.durum === 'İçeride'),
    },
    {
      title: 'Son 100 İşlem',
      count: 100,
      icon: 'pi-clock',
      color: '#64748b',
      details: allTransactions,
    },
    {
      title: 'Erken Çıkan Öğrenci',
      count: earlyLeavingStudents.length,
      icon: 'pi-exclamation-triangle',
      color: '#ea580c',
      details: earlyLeavingStudents,
    },
    {
      title: 'Öğretmen Bilgileri',
      count: teachers.length,
      icon: 'pi-id-card',
      color: '#0d9488',
      details: teachers,
    },
    {
      title: 'Geç Kalan Kişiler',
      count: latePeople.length,
      icon: 'pi-exclamation-circle',
      color: '#dc2134',
      details: latePeople,
    },
    {
      title: 'Toplam Ziyaretçi',
      count: totalVisitors.length,
      icon: 'pi-chart-bar',
      color: '#7c3aed',
      details: totalVisitors,
    },
    {
      title: 'Etkinlik Kişi Listesi',
      count: eventAttendees.length,
      icon: 'pi-calendar',
      color: '#0891b2',
      details: eventAttendees,
    },
  ];
}

export function getLast100Transactions(): TransactionRecord[] {
  return allTransactions;
}

export function getEarlyLeavingStudents(): EarlyLeavingStudent[] {
  return earlyLeavingStudents;
}

export function getLatePeople(): LatePerson[] {
  return latePeople;
}

export function getEventAttendees(): EventAttendee[] {
  return eventAttendees;
}

export function getTeachers(): PersonInfo[] {
  return teachers;
}
