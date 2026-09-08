export interface LastPassRecord {
  personId: number; // SicilId
  photoBase64: string | null; // FotoImage (Base64)
  identityNo: string; // SicilNo
  fullName: string; // AdSoyad
  department: string; // BolumAdi
  company: string; // FirmaAdi
  position: string; // Pozisyon
  passTime: string; // GecisZamani
  terminalId: number; // TerminalID
  terminalName: string; // TerminalAdi
  message: string; // Mesaj
  status: number; // Gecis (1: Success, 2: Failed vb.)
}

export interface TerminalGroup {
  id: number;
  name: string; // Ad
}
