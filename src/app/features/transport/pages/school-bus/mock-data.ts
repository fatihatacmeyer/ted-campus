// ─── Interfaces ─────────────────────────────────────────────────────────────

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

/** sp_ogrenciserviscampus_* prosedürlerindeki Yon kolonu: 1 = Gidiş, 2 = Dönüş. */
export type ServisYonu = 1 | 2;

/**
 * Bir öğrencinin bir servise (araca) atanma kaydı.
 * sp_ogrenciserviscampus_s'ten dönen satırın frontend karşılığıdır — atama
 * artık bağımsız bir varlık değil, doğrudan bir araca (ServisId) bağlıdır.
 */
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
