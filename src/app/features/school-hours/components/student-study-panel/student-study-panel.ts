import { ChangeDetectionStrategy, Component, OnInit, computed, effect, input, model, signal } from '@angular/core';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import { UpperCasePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Person } from '../../../../core/models/person.model';
import { WEEKDAYS, WeekdayDef } from '../../models/weekday.model';

/** dayIndex (1-7) -> studentId -> seçili mi */
export type RowSelections = Partial<Record<number, Record<number, boolean>>>;

function mergeSelections(base: RowSelections, overrides: RowSelections): RowSelections {
  const result: RowSelections = { ...base };
  for (const [dayIndex, dayMap] of Object.entries(overrides)) {
    const idx = Number(dayIndex);
    result[idx] = { ...(result[idx] ?? {}), ...dayMap };
  }
  return result;
}

/**
 * Bir sınıfın etüt günleri için öğrenci bazlı seçim paneli (satır genişletildiğinde açılır).
 * Arama metni bu bileşene özel yaşar: satır her açıldığında bileşen yeniden
 * oluşturulduğu için ayrıca "aramayı sıfırla" mantığına gerek kalmaz.
 *
 * `rowSelections` canlı/düzenlenebilir seçim durumudur (iki yönlü bağlanır).
 * `prefill` ise sunucudan asenkron gelen önceki seçimleri tek seferlik aktarmak içindir
 * (canlı state ile karışmasın diye kasıtlı olarak ayrı bir input üzerinden gelir).
 */
@Component({
  selector: 'app-student-study-panel',
  standalone: true,
  imports: [FormsModule, CheckboxModule, ButtonModule, TooltipModule, TranslatePipe, UpperCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './student-study-panel.html',
  styleUrl: './student-study-panel.scss',
})
export class StudentStudyPanelComponent implements OnInit {
  readonly students = input.required<Person[]>();
  readonly studyDayIndexes = input.required<number[]>();
  readonly gradeLabel = input<string>('');
  readonly prefill = input<RowSelections | undefined>(undefined);

  readonly rowSelections = model<RowSelections>({});

  readonly searchText = signal('');
  readonly days: readonly WeekdayDef[] = WEEKDAYS;

  protected readonly studentId = (s: Person): number => s.id;
  protected readonly studentDisplayName = (s: Person): string => s.adsoyad;

  readonly filteredStudents = computed(() => {
    const term = this.searchText().trim().toLocaleLowerCase('tr');
    const list = this.students();
    if (!term) return list;
    return list.filter((s) => s.adsoyad.toLocaleLowerCase('tr').includes(term));
  });

  private prefillApplied = false;

  constructor() {
    effect(() => {
      const incoming = this.prefill();
      if (incoming && !this.prefillApplied) {
        this.prefillApplied = true;
        this.rowSelections.update((current) => mergeSelections(current ?? {}, incoming));
      }
    });
  }

  ngOnInit(): void {
    // Signal input değerleri constructor'da okunamaz; bu yüzden varsayılan
    // (işaretsiz) girişler ngOnInit'te oluşturulur — checkbox'lar her zaman
    // tanımlı bir değere bağlanabilsin diye.
    const defaults: RowSelections = {};
    for (const dayIndex of this.studyDayIndexes()) {
      const dayMap: Record<number, boolean> = {};
      for (const student of this.students()) {
        dayMap[student.id] = false;
      }
      defaults[dayIndex] = dayMap;
    }
    this.rowSelections.set(mergeSelections(defaults, this.rowSelections() ?? {}));
  }

  hasStudyDay(dayIndex: number): boolean {
    return this.studyDayIndexes().includes(dayIndex);
  }

  isStudentDayChecked(dayIndex: number, sId: number): boolean {
    return !!this.rowSelections()[dayIndex]?.[sId];
  }

  setStudentDay(dayIndex: number, sId: number, checked: boolean): void {
    this.rowSelections.update((current) => ({
      ...current,
      [dayIndex]: { ...(current[dayIndex] ?? {}), [sId]: checked },
    }));
  }

  isDaySelectedForAll(dayIndex: number): boolean {
    const students = this.filteredStudents();
    if (students.length === 0) return false;
    const dayMap = this.rowSelections()[dayIndex];
    if (!dayMap) return false;
    return students.every((s) => dayMap[s.id]);
  }

  toggleDay(dayIndex: number, checked: boolean): void {
    const students = this.filteredStudents();
    this.rowSelections.update((current) => {
      const next: RowSelections = { ...current, [dayIndex]: { ...(current[dayIndex] ?? {}) } };
      for (const s of students) next[dayIndex]![s.id] = checked;
      return next;
    });
  }

  selectAll(): void {
    for (const dayIndex of this.studyDayIndexes()) this.toggleDay(dayIndex, true);
  }

  clearAll(): void {
    for (const dayIndex of this.studyDayIndexes()) this.toggleDay(dayIndex, false);
  }
}
