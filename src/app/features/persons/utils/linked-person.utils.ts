import { UserDef } from '../../../core/models/person.model';

/** Formdaki kişiye bağlanan taraf: öğrenci → veli, veli → öğrenci. */
export function linkedTargetUserdef(userdef: number): UserDef {
  return userdef === UserDef.Ogrenci ? UserDef.Veli : UserDef.Ogrenci;
}

/** İlişkili kişinin tekil adı (i18n anahtarı): öğrenci düzenlerken "Veli", veli düzenlerken "Öğrenci". */
export function linkedKindKey(userdef: number): string {
  return userdef === UserDef.Veli ? 'USERDEF.STUDENT' : 'USERDEF.PARENT';
}
