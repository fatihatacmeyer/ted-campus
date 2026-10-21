import { UserDef } from '../../../core/models/person.model';

export function linkedTargetUserdef(userdef: number): UserDef {
  return userdef === UserDef.Ogrenci ? UserDef.Veli : UserDef.Ogrenci;
}

export function linkedKindKey(userdef: number): string {
  return userdef === UserDef.Veli ? 'USERDEF.STUDENT' : 'USERDEF.PARENT';
}
