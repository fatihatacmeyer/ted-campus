export interface LastPassRecord {
  personId: number;
  photoBase64: string | null;
  profilePhotoFileName: string | null;
  personType: string | null;
  identityNo: string;
  fullName: string;
  department: string;
  company: string;
  position: string;
  passTime: string;
  terminalId: number;
  terminalName: string;
  message: string;
  status: number;
}

export interface TerminalGroup {
  id: number;
  name: string;
}
