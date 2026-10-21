import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { DropdownItem, TypesService } from '../../services/types.service';

@Injectable()
export class PersonFormOptions {
  private readonly typesService = inject(TypesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly firma = signal<DropdownItem[]>([]);
  readonly bolum = signal<DropdownItem[]>([]);
  readonly pozisyon = signal<DropdownItem[]>([]);
  readonly gorev = signal<DropdownItem[]>([]);
  readonly altfirma = signal<DropdownItem[]>([]);
  readonly direktorluk = signal<DropdownItem[]>([]);
  readonly yaka = signal<DropdownItem[]>([]);
  readonly gender = signal<{ label: string; value: string }[]>([]);
  readonly bloodType = signal<{ label: string; value: string }[]>([]);

  private genderIdByAd = new Map<string, number>();
  private bloodTypeIdByAd = new Map<string, number>();

  load(): void {
    forkJoin({
      cbo_firma: this.safe(this.typesService.getDropdownList('cbo_firma'), 'Firmalar'),
      cbo_bolum: this.safe(this.typesService.getDropdownList('cbo_bolum'), 'Bölümler'),
      cbo_pozisyon: this.safe(this.typesService.getDropdownList('cbo_pozisyon'), 'Pozisyonlar'),
      cbo_gorev: this.safe(this.typesService.getDropdownList('cbo_gorev'), 'Görevler'),
      cbo_altfirma: this.safe(this.typesService.getDropdownList('cbo_altfirma'), 'Alt firmalar'),
      cbo_direktorluk: this.safe(
        this.typesService.getDropdownList('cbo_direktorluk'),
        'Direktörlükler',
      ),
      cbo_yaka: this.safe(this.typesService.getDropdownList('cbo_yaka'), 'Yakalar'),
      sys_cinsiyet: this.safe(this.typesService.getGenderOptions(), 'Cinsiyet seçenekleri'),
      sys_KanGrubu: this.safe(this.typesService.getBloodTypes(), 'Kan grubu seçenekleri'),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((lists) => {
        this.firma.set(lists.cbo_firma);
        this.bolum.set(lists.cbo_bolum);
        this.pozisyon.set(lists.cbo_pozisyon);
        this.gorev.set(lists.cbo_gorev);
        this.altfirma.set(lists.cbo_altfirma);
        this.direktorluk.set(lists.cbo_direktorluk);
        this.yaka.set(lists.cbo_yaka);

        const genderLabelMap: Record<string, string> = {
          E: 'PERSON.GENDER_MALE',
          K: 'PERSON.GENDER_FEMALE',
        };
        this.gender.set(
          lists.sys_cinsiyet.map((item) => ({
            label: genderLabelMap[item.ad] ?? item.ad,
            value: String(item.id),
          })),
        );
        this.genderIdByAd = this.idLookup(lists.sys_cinsiyet);

        this.bloodType.set(
          lists.sys_KanGrubu.map((item) => ({ label: item.ad, value: String(item.id) })),
        );
        this.bloodTypeIdByAd = this.idLookup(lists.sys_KanGrubu);
      });
  }

  toGenderId(raw: unknown): string | null {
    return this.toOptionId(this.genderIdByAd, raw);
  }

  toBloodTypeId(raw: unknown): string | null {
    return this.toOptionId(this.bloodTypeIdByAd, raw);
  }

  private safe(source: Observable<DropdownItem[]>, label: string): Observable<DropdownItem[]> {
    return source.pipe(
      catchError((err) => {
        console.error(`${label} yüklenirken hata:`, err);
        return of([] as DropdownItem[]);
      }),
    );
  }

  private idLookup(items: DropdownItem[]): Map<string, number> {
    return new Map(items.map((item) => [item.ad, item.id]));
  }

  private toOptionId(lookup: Map<string, number>, raw: unknown): string | null {
    if (raw == null || raw === '') return null;
    const id = lookup.get(String(raw));
    return id != null ? String(id) : String(raw);
  }
}
