// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface Passenger {
  fullName: string;
  className: string;
  status: 'Binmiş' | 'İnmemiş' | 'Bekliyor';
}

export interface Bus {
  id: number;
  plate: string;
  brand: string;
  model: string;
  seatCount: number;
  occupiedSeats: number;
  emptySeats: number;
  description: string;
  status: string;
}


export type SeferTuru = 'Sabah' | 'Öğleden Sonra' | 'Akşam';

export interface BusAssignment {
  id: number;
  bus: Bus;
  passengers: Passenger[];
  departureTime: string;
  tripType: SeferTuru;
  status: 'Beklemede' | 'Yolda' | 'Tamamlandı';
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

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

  const statuses: Passenger['status'][] = ['Binmiş', 'İnmemiş', 'Bekliyor'];
  const classes = ['9-A', '9-B', '9-C', '10-A', '10-B', '10-C', '11-A', '11-B', '12-A', '12-B'];

  return Array.from({ length: count }, (_, i) => ({
    fullName: names[i % names.length],
    className: classes[i % classes.length],
    status: i < count * 0.65 ? statuses[0] : i < count * 0.9 ? statuses[1] : statuses[2],
  }));
};

export const MOCK_ASSIGNMENTS: BusAssignment[] = [
  {
    id: 1,
    bus: {
      id: 1,
      plate: '34 TED 001',
      brand: 'Mercedes',
      model: 'Sprinter',
      seatCount: 16,
      occupiedSeats: 12,
      emptySeats: 4,
      description: 'Sabah servisi - Kadıköy hattı',
      status: 'Aktif',
    },
    passengers: generatePassengers(32),
    departureTime: '06:30',
    tripType: 'Sabah',
    status: 'Tamamlandı',
  },
  {
    id: 2,
    bus: {
      id: 2,
      plate: '34 TED 002',
      brand: 'Mercedes',
      model: 'Sprinter',
      seatCount: 16,
      occupiedSeats: 14,
      emptySeats: 2,
      description: 'Sabah servisi - Üsküdar hattı',
      status: 'Aktif',
    },
    passengers: generatePassengers(38),
    departureTime: '06:45',
    tripType: 'Sabah',
    status: 'Tamamlandı',
  },
  {
    id: 3,
    bus: {
      id: 3,
      plate: '34 TED 003',
      brand: 'Volkswagen',
      model: 'Crafter',
      seatCount: 19,
      occupiedSeats: 15,
      emptySeats: 4,
      description: 'Sabah servisi - Ataşehir hattı',
      status: 'Aktif',
    },
    passengers: generatePassengers(24),
    departureTime: '07:00',
    tripType: 'Sabah',
    status: 'Yolda',
  },
  {
    id: 4,
    bus: {
      id: 4,
      plate: '34 TED 004',
      brand: 'Ford',
      model: 'Transit',
      seatCount: 17,
      occupiedSeats: 10,
      emptySeats: 7,
      description: 'Sabah servisi - Beykoz hattı',
      status: 'Aktif',
    },
    passengers: generatePassengers(41),
    departureTime: '06:30',
    tripType: 'Sabah',
    status: 'Yolda',
  },
  {
    id: 5,
    bus: {
      id: 1,
      plate: '34 TED 001',
      brand: 'Mercedes',
      model: 'Sprinter',
      seatCount: 16,
      occupiedSeats: 8,
      emptySeats: 8,
      description: 'Öğle servisi - Kadıköy hattı',
      status: 'Aktif',
    },
    passengers: generatePassengers(18),
    departureTime: '13:30',
    tripType: 'Öğleden Sonra',
    status: 'Beklemede',
  },
  {
    id: 6,
    bus: {
      id: 5,
      plate: '34 TED 005',
      brand: 'Otokar',
      model: 'Sultan',
      seatCount: 29,
      occupiedSeats: 22,
      emptySeats: 7,
      description: 'Öğle servisi - Kartal hattı',
      status: 'Aktif',
    },
    passengers: generatePassengers(29),
    departureTime: '14:00',
    tripType: 'Öğleden Sonra',
    status: 'Tamamlandı',
  },
  {
    id: 7,
    bus: {
      id: 1,
      plate: '34 TED 001',
      brand: 'Mercedes',
      model: 'Sprinter',
      seatCount: 16,
      occupiedSeats: 16,
      emptySeats: 0,
      description: 'Akşam servisi - Kadıköy hattı',
      status: 'Aktif',
    },
    passengers: generatePassengers(33),
    departureTime: '17:00',
    tripType: 'Akşam',
    status: 'Beklemede',
  },
];
