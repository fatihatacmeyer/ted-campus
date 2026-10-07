import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { TabsModule } from 'primeng/tabs';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { NotificationService } from '../../../../core/services/notification.service';
import { SchoolHoursService } from '../../services/school-hours.service';
import { SchoolHours } from '../../models/school-hours.model';
import { WEEKDAYS } from '../../models/weekday.model';
import { DropdownItem } from '../../../persons/services/types.service';
import { PersonService } from '../../../persons/services/person.service';
import { Person, UserDef } from '../../../../core/models/person.model';
import { isValidTime } from '../../../../shared/utils/time.utils';
import { compareClassNames, parseClassName } from '../../../../shared/utils/class-name.utils';

import { DayHoursCellComponent } from '../../components/day-hours-cell/day-hours-cell';
import { RowSelections, StudentStudyPanelComponent } from '../../components/student-study-panel/student-study-panel';

interface ClassOption {
  value?: number | string;
  label: string;
}

@Component({
  selector: 'app-school-hours-list',
  standalone: true,
  imports: [
    FormsModule,
    TableModule,
    ButtonModule,
    TooltipModule,
    ConfirmDialogModule,
    TabsModule,
    SelectModule,
    ToggleSwitchModule,
    TranslatePipe,
    DayHoursCellComponent,
    StudentStudyPanelComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './school-hours-list.html',
  styleUrl: './school-hours-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchoolHoursListComponent implements OnInit {
  protected readonly days = WEEKDAYS;

  // ---- reaktif ekran durumu (hepsi signal — CD tetiklemek için ChangeDetectorRef gerekmiyor) ----
  protected readonly hours = signal<SchoolHours[]>([]);
  protected readonly loading = signal(false);
  protected readonly campuses = signal<DropdownItem[]>([]);
  protected readonly classes = signal<DropdownItem[]>([]);
  protected readonly activeCampusId = signal<number | undefined>(undefined);
  protected readonly selectedClass = signal<number | string | undefined>(undefined);
  protected readonly classOptions = signal<ClassOption[]>([]);
  protected readonly grouped = signal(false);
  protected readonly editingRows = signal<Record<string, boolean>>({});
  protected readonly editingRowId = signal<number | null>(null);
  protected readonly studentsMap = signal<Map<string, Person[]>>(new Map());
  /** Satır düzenlemeye açıldığında sunucudan gelen önceki etüt seçimleri (tek seferlik aktarım). */
  protected readonly prefillByRow = signal<Record<number, RowSelections>>({});

  private previousCampusId: number | undefined;
  private previousClass: number | string | undefined;
  private clonedHours: Record<number, SchoolHours> = {};
  /** Panel bileşenleriyle iki yönlü bağlanan, canlı düzenlenen seçim önbelleği. */
  protected selectionsMap: Record<number, RowSelections> = {};

  private readonly personService = inject(PersonService);
  private readonly schoolHoursService = inject(SchoolHoursService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly notification = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.buildClassOptions();
    });
    this.loadFilterData();
    this.loadStudents();
  }

  // ---- öğrenciler -----------------------------------------------------
  protected getStudents(campusId: number | string, sinifId: number | string): Person[] {
    return this.studentsMap().get(`${campusId}_${sinifId}`) ?? [];
  }

  private loadStudents(): void {
    this.personService.getPersonListCampus().subscribe({
      next: (data) => {
        const map = new Map<string, Person[]>();
        data
          .filter((p) => p.userdef === UserDef.Ogrenci)
          .forEach((ogr) => {
            const key = `${ogr.firma}_${ogr.bolum}`;
            const bucket = map.get(key) ?? [];
            bucket.push(ogr);
            map.set(key, bucket);
          });
        this.studentsMap.set(map);
      },
      error: (err) => console.error('Öğrenciler yüklenemedi:', err),
    });
  }

  // ---- satır bazlı etüt/gün yardımcıları -------------------------------
  protected hasStudyTime(row: SchoolHours, dayKey: string): boolean {
    const r = row as unknown as Record<string, string | undefined>;
    return isValidTime(r[dayKey + 'EtutluBas']) && isValidTime(r[dayKey + 'EtutluBit']);
  }

  protected hasAnyStudyTime(row: SchoolHours): boolean {
    return this.days.some((d) => this.hasStudyTime(row, d.key));
  }

  protected studyDayIndexes(row: SchoolHours): number[] {
    return this.days.filter((d) => this.hasStudyTime(row, d.key)).map((d) => d.index);
  }

  // ---- satır düzenleme yaşam döngüsü -----------------------------------
  protected onRowEditInit(row: SchoolHours): void {
    if (this.editingRowId() !== null && this.editingRowId() !== row.Id) {
      this.notification.info('SCHOOL_HOURS.MSG_ONE_EDIT');
      return;
    }

    this.editingRowId.set(row.Id);
    this.clonedHours[row.Id] = { ...row };

    const students = this.getStudents(row.CampusId, row.SinifId);
    if (students.length > 0) {
      const requests = students.map((s) =>
        this.schoolHoursService.getSchoolHours(row.CampusId, row.SinifId, s.id),
      );

      forkJoin(requests).subscribe((results) => {
        const prefill: RowSelections = {};
        results.forEach((res, index) => {
          const gunler = (res?.[0] as any)?.Gunler as string | undefined;
          if (!gunler) return;
          const sId = students[index].id;
          gunler.split(',').forEach((val, idx) => {
            if (idx >= 7) return;
            const dayIndex = idx + 1;
            prefill[dayIndex] = { ...(prefill[dayIndex] ?? {}), [sId]: val === '1' };
          });
        });
        this.prefillByRow.update((m) => ({ ...m, [row.Id]: prefill }));
      });
    }

    this.editingRows.update((rows) => ({ ...rows, [row.Id]: true }));
  }

  protected onRowEditSave(row: SchoolHours): void {
    this.confirmationService.confirm({
      message: this.translate.instant('SCHOOL_HOURS.CONFIRM_MESSAGE', { grade: row.SinifSeviyesi }),
      header: this.translate.instant('SCHOOL_HOURS.CONFIRM_TITLE'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('SCHOOL_HOURS.CONFIRM_ACCEPT'),
      rejectLabel: this.translate.instant('SCHOOL_HOURS.CONFIRM_REJECT'),
      acceptButtonStyleClass: 'p-button-success',
      rejectButtonStyleClass: 'p-button-text p-button-danger',
      accept: () => this.updateRow(row),
      reject: () => {
        this.revertRow(row);
        this.finishEditing(row.Id);
      },
    });
  }

  protected onRowEditCancel(row: SchoolHours): void {
    this.revertRow(row);
    this.finishEditing(row.Id);
  }

  protected onRowSelectionsChange(rowId: number, value: RowSelections): void {
    this.selectionsMap[rowId] = value;
  }

  private updateRow(row: SchoolHours, onComplete?: () => void): void {
    this.loading.set(true);

    const students = this.getStudents(row.CampusId, row.SinifId);
    const rowSel = this.selectionsMap[row.Id] ?? {};
    let combinedString = '';

    if (students.length > 0) {
      combinedString = students
        .map((s) => {
          const sId = s.id;
          const flags = this.days.map((d) => (rowSel[d.index]?.[sId] ? '1' : '0'));
          return `${sId};${flags.join(',')}`;
        })
        .join('-');
    }

    const payload: SchoolHours = { ...row, GunlerVeSiciller: combinedString || undefined };

    this.schoolHoursService.updateSchoolHours(payload).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.sonuc === 1 || res.sonuc === 0) {
          this.notification.success('SCHOOL_HOURS.MSG_SAVED');
          this.finishEditing(row.Id);
          this.loadData();
          onComplete?.();
        } else {
          this.notification.error(res.sunucuCevap || 'SCHOOL_HOURS.ERROR_UPDATE');
          this.revertRow(row);
        }
      },
      error: () => {
        this.loading.set(false);
        this.notification.error('SCHOOL_HOURS.ERROR_SERVER');
        this.revertRow(row);
      },
    });
  }

  private revertRow(row: SchoolHours): void {
    const original = this.clonedHours[row.Id];
    if (!original) return;
    this.hours.update((list) => list.map((h) => (h.Id === row.Id ? original : h)));
  }

  private finishEditing(rowId: number): void {
    delete this.clonedHours[rowId];
    delete this.selectionsMap[rowId];
    this.prefillByRow.update((m) => {
      const copy = { ...m };
      delete copy[rowId];
      return copy;
    });
    this.editingRows.update((rows) => {
      const copy = { ...rows };
      delete copy[rowId];
      return copy;
    });
    this.editingRowId.set(null);
  }

  // ---- kampüs / sınıf filtreleri (kaydedilmemiş değişiklik kontrolü dahil) ----
  protected onCampusSelect(newCampusId: number | string | undefined): void {
    if (typeof newCampusId !== 'number') return;

    if (this.editingRowId() !== null) {
      this.promptUnsavedChanges(
        () => {
          this.previousCampusId = newCampusId;
          this.activeCampusId.set(newCampusId);
          this.onCampusChange();
        },
        () => this.activeCampusId.set(this.previousCampusId),
      );
    } else {
      this.previousCampusId = newCampusId;
      this.activeCampusId.set(newCampusId);
      this.onCampusChange();
    }
  }

  protected onClassSelect(newClassVal: number | string | undefined): void {
    if (this.editingRowId() !== null) {
      this.promptUnsavedChanges(
        () => {
          this.previousClass = newClassVal;
          this.selectedClass.set(newClassVal);
          this.onClassChange();
        },
        () => this.selectedClass.set(this.previousClass),
      );
    } else {
      this.previousClass = newClassVal;
      this.selectedClass.set(newClassVal);
      this.onClassChange();
    }
  }

  private promptUnsavedChanges(onProceed: () => void, onCancel: () => void): void {
    const rowId = this.editingRowId();
    if (rowId === null) {
      onProceed();
      return;
    }
    const row = this.hours().find((h) => h.Id === rowId);

    this.confirmationService.confirm({
      message: this.translate.instant('SCHOOL_HOURS.UNSAVED_MESSAGE'),
      header: this.translate.instant('SCHOOL_HOURS.UNSAVED_TITLE'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('SCHOOL_HOURS.SAVE_CONTINUE'),
      rejectLabel: this.translate.instant('SCHOOL_HOURS.DISCARD'),
      acceptButtonStyleClass: 'p-button-success',
      rejectButtonStyleClass: 'p-button-text p-button-danger',
      accept: () => {
        if (row) {
          this.updateRow(row, onProceed);
        } else {
          this.finishEditing(rowId);
          onProceed();
        }
      },
      reject: () => {
        if (row) this.revertRow(row);
        this.finishEditing(rowId);
        onCancel();
      },
    });
  }

  private onCampusChange(): void {
    this.selectedClass.set(undefined);
    this.previousClass = undefined;
    this.hours.set([]);
  }

  private onClassChange(): void {
    if (this.activeCampusId() === undefined || this.selectedClass() === undefined) {
      this.hours.set([]);
      return;
    }
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.schoolHoursService.getSchoolHours(this.activeCampusId()!, this.selectedClass()!).subscribe({
      next: (data) => {
        this.hours.set([...data]);
        this.loading.set(false);
      },
      error: () => {
        this.notification.error('SCHOOL_HOURS.ERROR_LOAD');
        this.loading.set(false);
      },
    });
  }

  private loadFilterData(): void {
    this.loading.set(true);
    this.schoolHoursService.getFilterData().subscribe({
      next: ({ campuses, classes }) => {
        this.campuses.set(campuses);
        this.classes.set(classes);
        this.buildClassOptions();
        if (campuses.length > 0) {
          this.activeCampusId.set(campuses[0].id);
          this.previousCampusId = campuses[0].id;
        }
        this.loading.set(false);
      },
      error: () => {
        this.notification.error('SCHOOL_HOURS.ERROR_LOAD');
        this.loading.set(false);
      },
    });
  }

  protected onGroupToggle(grouped: boolean): void {
    this.grouped.set(grouped);
    this.buildClassOptions();
  }

  private buildClassOptions(): void {
    const sortedClasses = [...this.classes()].sort((a, b) => compareClassNames(a.ad, b.ad));

    const allIds = sortedClasses.map((c) => c.id).join(',');
    const allLabel = this.translate.instant('SCHOOL_HOURS.ALL_CLASSES');

    if (!this.grouped()) {
      this.classOptions.set([
        { value: allIds, label: allLabel },
        ...sortedClasses.map((c) => ({ value: c.id, label: c.ad })),
      ]);
      return;
    }

    const suffix = this.translate.instant('SCHOOL_HOURS.GRADE_ALL_SUFFIX');
    const isTr = (this.translate.currentLang() ?? '').toLowerCase().startsWith('tr');
    const gradeIdMap = new Map<number, number[]>();

    sortedClasses.forEach((c) => {
      const grade = parseClassName(c.ad).grade;
      if (grade !== null) {
        const ids = gradeIdMap.get(grade) ?? [];
        ids.push(c.id);
        gradeIdMap.set(grade, ids);
      }
    });

    const options: ClassOption[] = [{ value: allIds, label: allLabel }];
    gradeIdMap.forEach((ids, grade) => {
      const label = isTr ? `${grade}. Sınıfların ${suffix}` : `Grade ${grade} ${suffix}`;
      options.push({ value: ids.join(','), label });
    });
    this.classOptions.set(options);
  }
}
