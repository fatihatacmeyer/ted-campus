/** Mock etkinlik katılımcısı — gerçek API bağlandığında kaldırılacak. */
export interface MockActivityParticipant {
  id: number;
  ogrenci: string; // öğrenci ad soyad
  sinif: string; // örn: '5-A'
  veli: string; // veli ad soyad
  telefon: string; // örn: '0532 111 22 33'
  durum: 'Bekleyen' | 'Onaylanan' | 'Reddedilen';
}

export const MOCK_ACTIVITY_PARTICIPANTS: MockActivityParticipant[] = [
  {
    id: 1,
    ogrenci: 'Elif Yılmaz',
    sinif: '5-A',
    veli: 'Ayşe Yılmaz',
    telefon: '0532 111 22 33',
    durum: 'Onaylanan',
  },
  {
    id: 2,
    ogrenci: 'Mert Kaya',
    sinif: '4-B',
    veli: 'Hasan Kaya',
    telefon: '0533 222 33 44',
    durum: 'Onaylanan',
  },
  {
    id: 3,
    ogrenci: 'Zeynep Demir',
    sinif: '6-A',
    veli: 'Fatma Demir',
    telefon: '0505 333 44 55',
    durum: 'Bekleyen',
  },
  {
    id: 4,
    ogrenci: 'Emirhan Çelik',
    sinif: '5-B',
    veli: 'Mehmet Çelik',
    telefon: '0542 444 55 66',
    durum: 'Onaylanan',
  },
  {
    id: 5,
    ogrenci: 'Defne Aydın',
    sinif: '4-A',
    veli: 'Zehra Aydın',
    telefon: '0536 555 66 77',
    durum: 'Reddedilen',
  },
  {
    id: 6,
    ogrenci: 'Yusuf Şahin',
    sinif: '7-C',
    veli: 'Ali Şahin',
    telefon: '0507 666 77 88',
    durum: 'Onaylanan',
  },
  {
    id: 7,
    ogrenci: 'İrem Koç',
    sinif: '8-B',
    veli: 'Gül Koç',
    telefon: '0535 777 88 99',
    durum: 'Bekleyen',
  },
  {
    id: 8,
    ogrenci: 'Kerem Öztürk',
    sinif: '5-A',
    veli: 'Mustafa Öztürk',
    telefon: '0541 888 99 00',
    durum: 'Onaylanan',
  },
  {
    id: 9,
    ogrenci: 'Melis Arslan',
    sinif: '6-A',
    veli: 'Sevgi Arslan',
    telefon: '0538 999 00 11',
    durum: 'Bekleyen',
  },
  {
    id: 10,
    ogrenci: 'Baran Doğan',
    sinif: '4-B',
    veli: 'Emre Doğan',
    telefon: '0506 000 11 22',
    durum: 'Reddedilen',
  },
];
