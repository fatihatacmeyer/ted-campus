export interface SchoolHours {
  Id: number;
  CampusId: number;
  SınıfId: number;
  SinifSeviyesi: string;
  Aciklama?: string;

  PazartesiBas?: string;
  PazartesiBit?: string;
  PazartesiEtutluBas?: string;
  PazartesiEtutluBit?: string;
  SaliBas?: string;
  SaliBit?: string;
  SaliEtutluBas?: string;
  SaliEtutluBit?: string;
  CarsambaBas?: string;
  CarsambaBit?: string;
  CarsambaEtutluBas?: string;
  CarsambaEtutluBit?: string;
  PersembeBas?: string;
  PersembeBit?: string;
  PersembeEtutluBas?: string;
  PersembeEtutluBit?: string;
  CumaBas?: string;
  CumaBit?: string;
  CumaEtutluBas?: string;
  CumaEtutluBit?: string;
  CumartesiBas?: string;
  CumartesiBit?: string;
  CumartesiEtutluBas?: string;
  CumartesiEtutluBit?: string;
  PazarBas?: string;
  PazarBit?: string;
  PazarEtutluBas?: string;
  PazarEtutluBit?: string;
}

export interface DBResult {
  Sonuc: number | string;
  SunucuCevap: string;
}
