import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { DropdownItem, TypesService } from '../../persons/services/types.service';

export interface ClassGroup {
  label: string;
  items: { label: string; value: string }[];
}

@Injectable()
export class ActivityLookups {
  private readonly typesService = inject(TypesService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly types = signal<DropdownItem[]>([]);
  readonly transportations = signal<DropdownItem[]>([]);
  readonly educationLevels = signal<DropdownItem[]>([]);
  readonly campuses = signal<DropdownItem[]>([]);
  readonly classrooms = signal<DropdownItem[]>([]);
  readonly classroomGroups = signal<ClassGroup[]>([]);

  load(): void {
    forkJoin({
      TurCampus: this.safe(this.typesService.getDropdownList('TurCampus'), 'Etkinlik türleri'),
      UlasimCampus: this.safe(
        this.typesService.getDropdownList('UlasimCampus'),
        'Ulaşım bilgileri',
      ),
      cbo_bolum: this.safe(this.typesService.getDropdownList('cbo_bolum'), 'Sınıflar'),
      cbo_direktorluk: this.safe(
        this.typesService.getDropdownList('cbo_direktorluk'),
        'Eğitim düzeyleri',
      ),
      cbo_firma: this.safe(this.typesService.getDropdownList('cbo_firma'), 'Kampüs bilgileri'),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ TurCampus, UlasimCampus, cbo_bolum, cbo_direktorluk, cbo_firma }) => {
        this.types.set(TurCampus);
        this.transportations.set(UlasimCampus);
        this.classrooms.set(cbo_bolum);
        this.classroomGroups.set(this.buildClassroomGroups(cbo_bolum));
        this.educationLevels.set(cbo_direktorluk);
        this.campuses.set(cbo_firma);
      });
  }

  private safe(source: Observable<DropdownItem[]>, label: string): Observable<DropdownItem[]> {
    return source.pipe(
      catchError((err) => {
        console.error(`${label} yüklenirken hata:`, err);
        return of([] as DropdownItem[]);
      }),
    );
  }

  private buildClassroomGroups(items: DropdownItem[]): ClassGroup[] {
    const groups = new Map<string, { label: string; value: string }[]>();
    for (const item of items) {
      const gradeMatch = item.ad.trim().match(/^(\d+)/);
      const groupLabel = gradeMatch
        ? this.translate.instant('ACTIVITIES.GRADE_CLASSES', { grade: gradeMatch[1] })
        : this.translate.instant('ACTIVITIES.OTHERS');
      if (!groups.has(groupLabel)) {
        groups.set(groupLabel, []);
      }
      groups.get(groupLabel)!.push({ label: item.ad, value: item.ad });
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => {
        const na = Number.parseInt(a, 10);
        const nb = Number.parseInt(b, 10);
        if (Number.isNaN(na)) return 1;
        if (Number.isNaN(nb)) return -1;
        return na - nb;
      })
      .map(([label, items]) => ({ label, items }));
  }
}
