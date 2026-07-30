// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface Driver {
  id: number;
  adSoyad: string;
  telefon: string;
}

export interface Hostess {
  id: number;
  adSoyad: string;
  telefon: string;
}

export interface Passenger {
  adSoyad: string;
  sinif: string;
  durum: 'Binmiş' | 'İnmemiş' | 'Bekliyor';
}

export interface Bus {
  id: number;
  adi: string;       // "1 nolu Servis"
  plaka: string;
}

export type SeferTuru = 'Sabah' | 'Öğleden Sonra' | 'Akşam';

export interface BusAssignment {
  id: number;
  bus: Bus;
  sofor: Driver;
  hostes: Hostess | null;
  yolcular: Passenger[];
  kalkisSaati: string;
  seferTuru: SeferTuru;
  durum: 'Beklemede' | 'Yolda' | 'Tamamlandı';
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

export const MOCK_DRIVERS: Driver[] = [
  { id: 1, adSoyad: 'Mehmet Şahin',    telefon: '0532 111 22 33' },
  { id: 2, adSoyad: 'Ali Yıldırım',    telefon: '0535 444 55 66' },
  { id: 3, adSoyad: 'Hasan Kaya',       telefon: '0542 777 88 99' },
  { id: 4, adSoyad: 'İbrahim Çelik',    telefon: '0538 123 45 67' },
  { id: 5, adSoyad: 'Osman Demir',      telefon: '0530 987 65 43' },
  { id: 6, adSoyad: 'Kemal Arslan',     telefon: '0536 234 56 78' },
  { id: 7, adSoyad: 'Yusuf Öztürk',     telefon: '0541 345 67 89' },
];

export const MOCK_HOSTESSES: Hostess[] = [
  { id: 1, adSoyad: 'Ayşe Arslan',     telefon: '0536 111 22 33' },
  { id: 2, adSoyad: 'Fatma Gül',       telefon: '0541 444 55 66' },
  { id: 3, adSoyad: 'Zeynep Koç',      telefon: '0533 777 88 99' },
  { id: 4, adSoyad: 'Elif Aydın',      telefon: '0537 321 65 49' },
  { id: 5, adSoyad: 'Merve Şimşek',    telefon: '0544 654 32 10' },
  { id: 6, adSoyad: 'Seda Erdem',      telefon: '0539 876 54 32' },
];

export const MOCK_BUSES: Bus[] = [
  { id: 1, adi: '1 nolu Servis', plaka: '34 TED 001' },
  { id: 2, adi: '2 nolu Servis', plaka: '34 TED 002' },
  { id: 3, adi: '3 nolu Servis', plaka: '34 TED 003' },
  { id: 4, adi: '4 nolu Servis', plaka: '34 TED 004' },
  { id: 5, adi: '5 nolu Servis', plaka: '34 TED 005' },
  { id: 6, adi: '6 nolu Servis', plaka: '34 TED 006' },
  { id: 7, adi: '7 nolu Servis', plaka: '34 TED 007' },
];

const generatePassengers = (count: number): Passenger[] => {
  const names = [
    'Ahmet Yılmaz',   'Buse Kara',       'Can Demir',       'Deniz Şahin',     'Ece Arslan',
    'Furkan Çelik',   'Gizem Kaya',      'Hakan Yıldırım',  'İrem Gül',        'Jale Aydın',
    'Kemal Koç',      'Leyla Demir',     'Murat Şimşek',    'Nisa Çetin',      'Onur Polat',
    'Pınar Aksoy',    'Ramazan Bulut',   'Seda Erdem',      'Tolga Güneş',     'Uğur Taş',
    'Vildan Çelik',   'Yusuf Arslan',    'Zehra Korkmaz',   'Berk Aydın',      'Ceren Şahin',
    'Derya Yılmaz',   'Emre Demir',      'Filiz Kaya',      'Gökhan Çelik',    'Hülya Şimşek',
    'İlker Polat',    'Jülide Aksoy',    'Kaan Güneş',      'Lale Bulut',      'Mert Erdem',
    'Nur Taş',        'Oğuz Çetin',      'Pelin Arslan',    'Recep Yıldırım',  'Selma Koç',
    'Tarık Aydın',    'Umut Şahin',      'Veli Demir',      'Yasemin Çelik',   'Zeki Kaya',
    'Aylin Polat',    'Baran Demirbaş',  'Cemre Aksoy',     'Emirhan Bulut',   'Gülşen Taş',
    'Hüseyin Arslan', 'İpek Güneş',      'Janset Çelik',    'Kübra Yıldırım',  'Levent Koç',
  ];

  const durumlar: Passenger['durum'][] = ['Binmiş', 'İnmemiş', 'Bekliyor'];
  const siniflar = ['9-A', '9-B', '9-C', '10-A', '10-B', '10-C', '11-A', '11-B', '12-A', '12-B'];

  return Array.from({ length: count }, (_, i) => ({
    adSoyad: names[i % names.length],
    sinif: siniflar[i % siniflar.length],
    durum: i < count * 0.65 ? durumlar[0] : i < count * 0.9 ? durumlar[1] : durumlar[2],
  }));
};

export const MOCK_ASSIGNMENTS: BusAssignment[] = [
  {
    id: 1,
    bus: MOCK_BUSES[0],
    sofor: MOCK_DRIVERS[0],
    hostes: MOCK_HOSTESSES[0],
    yolcular: generatePassengers(32),
    kalkisSaati: '06:30',
    seferTuru: 'Sabah',
    durum: 'Tamamlandı',
  },
  {
    id: 2,
    bus: MOCK_BUSES[1],
    sofor: MOCK_DRIVERS[1],
    hostes: MOCK_HOSTESSES[1],
    yolcular: generatePassengers(38),
    kalkisSaati: '06:45',
    seferTuru: 'Sabah',
    durum: 'Tamamlandı',
  },
  {
    id: 3,
    bus: MOCK_BUSES[2],
    sofor: MOCK_DRIVERS[2],
    hostes: MOCK_HOSTESSES[2],
    yolcular: generatePassengers(24),
    kalkisSaati: '07:00',
    seferTuru: 'Sabah',
    durum: 'Yolda',
  },
  {
    id: 4,
    bus: MOCK_BUSES[3],
    sofor: MOCK_DRIVERS[3],
    hostes: MOCK_HOSTESSES[3],
    yolcular: generatePassengers(41),
    kalkisSaati: '06:30',
    seferTuru: 'Sabah',
    durum: 'Yolda',
  },
  {
    id: 5,
    bus: MOCK_BUSES[0],
    sofor: MOCK_DRIVERS[4],
    hostes: null,
    yolcular: generatePassengers(18),
    kalkisSaati: '13:30',
    seferTuru: 'Öğleden Sonra',
    durum: 'Beklemede',
  },
  {
    id: 6,
    bus: MOCK_BUSES[4],
    sofor: MOCK_DRIVERS[5],
    hostes: MOCK_HOSTESSES[5],
    yolcular: generatePassengers(29),
    kalkisSaati: '14:00',
    seferTuru: 'Öğleden Sonra',
    durum: 'Tamamlandı',
  },
  {
    id: 7,
    bus: MOCK_BUSES[0],
    sofor: MOCK_DRIVERS[6],
    hostes: null,
    yolcular: generatePassengers(33),
    kalkisSaati: '17:00',
    seferTuru: 'Akşam',
    durum: 'Beklemede',
  },
];
