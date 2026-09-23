import {
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { DropdownItem } from '../../../persons/services/types.service';
import { PersonService } from '../../../persons/services/person.service';
import { Person, UserDef } from '../../../../core/models/person.model';
import { CheckboxModule } from 'primeng/checkbox';
import { forkJoin } from 'rxjs';

interface ClassOption {
  value?: number | string;
  label: string;
}

@Component({
  selector: 'app-school-hours-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    TooltipModule,
    ConfirmDialogModule,
    TabsModule,
    SelectModule,
    ToggleSwitchModule,
    TranslatePipe,
    CheckboxModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './school-hours-list.html',
  styleUrl: './school-hours-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchoolHoursListComponent implements OnInit {
  hours: SchoolHours[] = [];
  loading = false;
  studentSearchText: string = '';

  campuses: DropdownItem[] = [];
  classes: DropdownItem[] = [];

  activeCampusId: number | undefined;
  previousCampusId: number | undefined;
  selectedClass: number | string | undefined;
  previousClass: number | string | undefined;
  classOptions: ClassOption[] = [];
  grouped = false;
  clonedHours: { [s: number]: SchoolHours } = {};

  expandedRows: { [key: string]: boolean } = {};
  editingRows: { [key: string]: boolean } = {};
  editingRowId: number | null = null;

  studentsMap = new Map<string, Person[]>();
  selections: Record<number, Record<number, Record<number, boolean>>> = {};

  private personService = inject(PersonService);
  private schoolHoursService = inject(SchoolHoursService);
  private confirmationService = inject(ConfirmationService);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  days = [
    { key: 'Pazartesi', headerKey: 'DAYS.MONDAY', index: 1 },
    { key: 'Sali', headerKey: 'DAYS.TUESDAY', index: 2 },
    { key: 'Carsamba', headerKey: 'DAYS.WEDNESDAY', index: 3 },
    { key: 'Persembe', headerKey: 'DAYS.THURSDAY', index: 4 },
    { key: 'Cuma', headerKey: 'DAYS.FRIDAY', index: 5 },
    { key: 'Cumartesi', headerKey: 'DAYS.SATURDAY', index: 6 },
    { key: 'Pazar', headerKey: 'DAYS.SUNDAY', index: 7 },
  ];

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.buildClassOptions();
      this.cdr.markForCheck();
    });
    this.loadFilterData();
    this.loadStudents();
  }

  getStudentId(student: any): number {
    return student.id ?? student.Id ?? student.sicilId ?? student.sicilid;
  }

  loadStudents(): void {
    this.personService.getPersonListCampus().subscribe({
      next: (data) => {
        const ogrenciler = data.filter((p) => p.userdef === UserDef.Ogrenci);
        this.studentsMap.clear();
        ogrenciler.forEach((ogr) => {
          const key = `${ogr.firma}_${ogr.bolum}`;
          if (!this.studentsMap.has(key)) {
            this.studentsMap.set(key, []);
          }
          this.studentsMap.get(key)!.push(ogr);
        });
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Öğrenciler yüklenemedi:', err),
    });
  }

  getStudents(campusId: number | string, sinifId: number | string): Person[] {
    const key = `${campusId}_${sinifId}`;
    return this.studentsMap.get(key) || [];
  }

  initSelections(rowId: number, campusId: number, sinifId: number): void {
    if (!this.selections[rowId]) {
      this.selections[rowId] = {};
    }
    const students = this.getStudents(campusId, sinifId);
    this.days.forEach((d) => {
      this.selections[rowId][d.index] = this.selections[rowId][d.index] || {};
      students.forEach((s) => {
        const sId = this.getStudentId(s);
        if (this.selections[rowId][d.index][sId] === undefined) {
          this.selections[rowId][d.index][sId] = false;
        }
      });
    });
  }

  selectAll(rowId: number, campusId: number, sinifId: number): void {
    const students = this.getFilteredStudents(campusId, sinifId);
    if (!this.selections[rowId]) this.initSelections(rowId, campusId, sinifId);

    students.forEach((s) => {
      const sId = this.getStudentId(s);
      this.days.forEach((d) => {
        this.selections[rowId][d.index][sId] = true;
      });
    });
    this.cdr.markForCheck();
  }

  clearAll(rowId: number, campusId: number, sinifId: number): void {
    const students = this.getFilteredStudents(campusId, sinifId);
    if (!this.selections[rowId]) this.initSelections(rowId, campusId, sinifId);

    students.forEach((s) => {
      const sId = this.getStudentId(s);
      this.days.forEach((d) => {
        this.selections[rowId][d.index][sId] = false;
      });
    });
    this.cdr.markForCheck();
  }

  onRowEditInit(row: SchoolHours) {
    if (this.editingRowId !== null && this.editingRowId !== row.Id) {
      this.notification.info('Aynı anda sadece bir sınıf düzenlenebilir.');
      return;
    }

    this.studentSearchText = '';
    this.editingRowId = row.Id;
    this.clonedHours[row.Id] = { ...row };
    this.initSelections(row.Id, row.CampusId, row.SinifId);

    const students = this.getStudents(row.CampusId, row.SinifId);
    if (students.length > 0) {
      const requests = students.map((s) => {
        const sId = this.getStudentId(s);
        return this.schoolHoursService.getSchoolHours(row.CampusId, row.SinifId, sId);
      });

      forkJoin(requests).subscribe((results) => {
        results.forEach((res, index) => {
          const s = students[index];
          const sId = this.getStudentId(s);
          if (res && res.length > 0 && (res[0] as any).Gunler) {
            const parts = (res[0] as any).Gunler.split(',');
            parts.forEach((val: string, idx: number) => {
              if (idx < 7) {
                this.selections[row.Id][idx + 1][sId] = val === '1';
              }
            });
          }
        });
        this.cdr.markForCheck();
      });
    }

    this.expandedRows = { ...this.expandedRows, [String(row.Id)]: true };
    this.editingRows = { ...this.editingRows, [String(row.Id)]: true };
    this.cdr.markForCheck();
  }

  onRowEditSave(row: SchoolHours) {
    this.confirmationService.confirm({
      message: this.translate.instant('SCHOOL_HOURS.CONFIRM_MESSAGE', { grade: row.SinifSeviyesi }),
      header: this.translate.instant('SCHOOL_HOURS.CONFIRM_TITLE'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('SCHOOL_HOURS.CONFIRM_ACCEPT'),
      rejectLabel: this.translate.instant('SCHOOL_HOURS.CONFIRM_REJECT'),
      acceptButtonStyleClass: 'p-button-success',
      rejectButtonStyleClass: 'p-button-text p-button-danger',
      accept: () => {
        this.updateRow(row);
      },
      reject: () => {
        this.revertRow(row);
        this.collapseRow(row.Id);
        this.clearEditingState(row.Id);
      },
    });
  }

  onRowEditCancel(row: SchoolHours) {
    this.revertRow(row);
    this.clearSelections(row.Id);
    this.collapseRow(row.Id);
    this.clearEditingState(row.Id);
  }

  private clearSelections(rowId: number) {
    if (this.selections[rowId]) {
      delete this.selections[rowId];
      this.cdr.markForCheck();
    }
  }

  private collapseRow(rowId: number) {
    const newExpanded = { ...this.expandedRows };
    delete newExpanded[String(rowId)];
    this.expandedRows = newExpanded;
    this.cdr.markForCheck();
  }

  private clearEditingState(rowId: number) {
    const newEditing = { ...this.editingRows };
    delete newEditing[String(rowId)];
    this.editingRows = newEditing;
    this.editingRowId = null;
    this.cdr.markForCheck();
  }

  // YENİ JSON OLUŞTURUCU (Tüm öğrencileri tek bir stringe dönüştürür)
  private updateRow(row: SchoolHours, onComplete?: () => void) {
    this.loading = true;
    this.cdr.markForCheck();

    const students = this.getStudents(row.CampusId, row.SinifId);
    let combinedString = '';

    if (students.length > 0) {
      const parts: string[] = [];
      students.forEach((s) => {
        const sId = this.getStudentId(s);
        const gunlerArr = [];
        for (let i = 1; i <= 7; i++) {
          // Seçili değilse bile 0 olarak array'e atıyoruz. (0,0,0,0,0,0,0)
          gunlerArr.push(this.selections[row.Id]?.[i]?.[sId] ? '1' : '0');
        }
        parts.push(`${sId};${gunlerArr.join(',')}`);
      });
      // "SicilId;1,0,0,1,0,0,0-SicilId2;1,1,1..." formatında birleşir.
      combinedString = parts.join('-');
    }

    const payload = {
      ...row,
      GunlerVeSiciller: combinedString || undefined,
    };

    // Tek bir istek ile her şeyi yolluyoruz (Deadlock tehlikesi sıfırlandı)
    this.schoolHoursService.updateSchoolHours(payload).subscribe({
      next: (res) => {
        if (res.sonuc === 1 || res.sonuc === 0) {
          this.notification.success('Saatler ve öğrenci etütleri başarıyla kaydedildi.');
          delete this.clonedHours[row.Id];
          this.collapseRow(row.Id);
          this.clearEditingState(row.Id);
          this.loadData();
          if (onComplete) onComplete();
        } else {
          this.notification.error(res.sunucuCevap || 'SCHOOL_HOURS.ERROR_UPDATE');
          this.revertRow(row);
          this.loading = false;
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.notification.error('SCHOOL_HOURS.ERROR_SERVER');
        this.revertRow(row);
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private revertRow(row: SchoolHours) {
    const index = this.hours.findIndex((h) => h.Id === row.Id);
    if (index !== -1) {
      this.hours[index] = this.clonedHours[row.Id];
    }
    delete this.clonedHours[row.Id];
    this.cdr.markForCheck();
  }

  onCampusSelect(newCampusId: number | string | undefined) {
    if (typeof newCampusId !== 'number') return;
    if (this.editingRowId !== null) {
      this.promptUnsavedChanges(
        () => {
          this.activeCampusId = newCampusId;
          this.previousCampusId = newCampusId;
          this.onCampusChange(newCampusId);
        },
        () => {
          this.activeCampusId = this.previousCampusId;
          this.cdr.markForCheck();
        },
      );
    } else {
      this.previousCampusId = newCampusId;
      this.activeCampusId = newCampusId;
      this.onCampusChange(newCampusId);
    }
  }

  onClassSelect(newClassVal: number | string | undefined) {
    if (this.editingRowId !== null) {
      this.promptUnsavedChanges(
        () => {
          this.selectedClass = newClassVal;
          this.previousClass = newClassVal;
          this.onClassChange();
        },
        () => {
          this.selectedClass = this.previousClass;
          this.cdr.markForCheck();
        },
      );
    } else {
      this.selectedClass = newClassVal;
      this.previousClass = newClassVal;
      this.onClassChange();
    }
  }

  private promptUnsavedChanges(onSaveAndProceed: () => void, onCancelFilterChange: () => void) {
    const rowId = this.editingRowId!;
    const row = this.hours.find((h) => h.Id === rowId);

    this.confirmationService.confirm({
      message:
        'Açık olan bir düzenlemeniz var. Filtreyi değiştirmeden önce bu değişiklikleri kaydetmek ister misiniz?',
      header: 'Kaydedilmemiş Değişiklikler',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Kaydet ve Devam Et',
      rejectLabel: 'İptal Et (Değişiklikleri Çöpe At)', // Metni biraz daha netleştirebiliriz
      acceptButtonStyleClass: 'p-button-success',
      rejectButtonStyleClass: 'p-button-text p-button-danger', // Rengi kırmızı yapalım ki silindiği anlaşılsın
      accept: () => {
        if (row) {
          this.updateRow(row, onSaveAndProceed);
        } else {
          this.clearSelections(rowId); // Her ihtimale karşı
          this.clearEditingState(rowId);
          onSaveAndProceed();
        }
      },
      reject: () => {
        // YENİ EKLENEN KISIM: İptal dendiğinde değişiklikleri geri al ve seçimleri temizle
        if (row) {
          this.revertRow(row);
        }
        this.clearSelections(rowId);
        this.collapseRow(rowId);
        this.clearEditingState(rowId);
        onCancelFilterChange();
      },
    });
  }

  getFilteredStudents(campusId: number | string, sinifId: number | string): Person[] {
    const students = this.getStudents(campusId, sinifId);
    if (!this.studentSearchText || this.studentSearchText.trim() === '') {
      return students;
    }

    const term = this.studentSearchText.toLocaleLowerCase('tr');
    return students.filter((s) => {
      const fullName = (s.adsoyad || s.ad + ' ' + s.soyad).toLocaleLowerCase('tr');
      return fullName.includes(term);
    });
  }

  isDayAllSelected(rowId: number, campusId: number, sinifId: number, dayIndex: number): boolean {
    const students = this.getFilteredStudents(campusId, sinifId);
    if (students.length === 0) return false;
    if (!this.selections[rowId] || !this.selections[rowId][dayIndex]) return false;

    return students.every((s) => this.selections[rowId][dayIndex][this.getStudentId(s)]);
  }

  toggleDaySelection(
    rowId: number,
    campusId: number,
    sinifId: number,
    dayIndex: number,
    checked: boolean,
  ): void {
    const students = this.getFilteredStudents(campusId, sinifId);
    if (!this.selections[rowId]) this.initSelections(rowId, campusId, sinifId);

    students.forEach((s) => {
      const sId = this.getStudentId(s);
      this.selections[rowId][dayIndex][sId] = checked;
    });
    this.cdr.markForCheck();
  }

  loadFilterData(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.schoolHoursService.getFilterData().subscribe({
      next: ({ campuses, classes }) => {
        this.campuses = campuses;
        this.classes = classes;
        this.buildClassOptions();
        if (this.campuses.length > 0) {
          this.activeCampusId = this.campuses[0].id;
          this.previousCampusId = this.activeCampusId;
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.notification.error('SCHOOL_HOURS.ERROR_LOAD');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private buildClassOptions(): void {
    const gradeOf = (ad: string): number | null => {
      const match = ad.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    };
    const sortedClasses = [...this.classes].sort((a, b) => {
      const regex = /^(\d+)[-/\s]*(.*)$/;
      const matchA = a.ad.match(regex);
      const matchB = b.ad.match(regex);
      if (matchA && matchB) {
        const numA = parseInt(matchA[1], 10);
        const numB = parseInt(matchB[1], 10);
        if (numA !== numB) return numA - numB;
        return matchA[2].localeCompare(matchB[2], 'tr');
      }
      return a.ad.localeCompare(b.ad, 'tr', { numeric: true });
    });

    const allIds = sortedClasses.map((c) => c.id).join(',');
    const allLabel = this.translate.instant('SCHOOL_HOURS.ALL_CLASSES');

    if (!this.grouped) {
      this.classOptions = [
        { value: allIds, label: allLabel },
        ...sortedClasses.map((c) => ({ value: c.id, label: c.ad })),
      ];
      return;
    }

    const suffix = this.translate.instant('SCHOOL_HOURS.GRADE_ALL_SUFFIX');
    const isTr = (this.translate.currentLang() ?? '').toLowerCase().startsWith('tr');
    const gradeIdMap = new Map<number, number[]>();

    sortedClasses.forEach((c) => {
      const grade = gradeOf(c.ad);
      if (grade !== null) {
        if (!gradeIdMap.has(grade)) {
          gradeIdMap.set(grade, []);
        }
        gradeIdMap.get(grade)!.push(c.id);
      }
    });

    this.classOptions = [{ value: allIds, label: allLabel }];
    gradeIdMap.forEach((ids, grade) => {
      const label = isTr ? `${grade}. Sınıfların ${suffix}` : `Grade ${grade} ${suffix}`;
      this.classOptions.push({ value: ids.join(','), label });
    });
  }

  onGroupToggle(grouped: boolean): void {
    this.grouped = grouped;
    this.buildClassOptions();
    this.cdr.markForCheck();
  }

  onCampusChange(campusId: number | string | undefined): void {
    this.selectedClass = undefined;
    this.previousClass = undefined;
    this.hours = [];
    this.cdr.markForCheck();
  }

  onClassChange(): void {
    if (this.activeCampusId === undefined || this.selectedClass === undefined) {
      this.hours = [];
      this.cdr.markForCheck();
      return;
    }
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.schoolHoursService.getSchoolHours(this.activeCampusId!, this.selectedClass!).subscribe({
      next: (data) => {
        this.hours = [...data];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.notification.error('SCHOOL_HOURS.ERROR_LOAD');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onTimeFocus(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    input.select();
  }

  onTimeKeyDown(event: KeyboardEvent, row: any, fieldKey: string): void {
    const input = event.target as HTMLInputElement;
    const key = event.key;
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      ['Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)
    )
      return;

    const val = input.value || '';
    const selStart = input.selectionStart ?? 0;
    const selEnd = input.selectionEnd ?? 0;
    const hasSelection = selEnd > selStart;

    if (/^[0-9]$/.test(key)) {
      if (hasSelection) return;
      if (val.length === 5 && val[2] === ':') {
        event.preventDefault();
        const chars = val.split('');
        let nextCursor = selStart;
        if (selStart === 0) {
          chars[0] = key;
          nextCursor = 1;
        } else if (selStart === 1) {
          chars[1] = key;
          nextCursor = 3;
        } else if (selStart === 2 || selStart === 3) {
          chars[3] = key;
          nextCursor = 4;
        } else if (selStart === 4) {
          chars[4] = key;
          nextCursor = 5;
        } else return;
        const newVal = chars.join('');
        row[fieldKey] = newVal;
        input.value = newVal;
        input.setSelectionRange(nextCursor, nextCursor);
        return;
      }
    }

    if (key === 'Backspace' && !hasSelection && val.length === 5 && val[2] === ':') {
      if (selStart === 3) {
        event.preventDefault();
        const chars = val.split('');
        chars[1] = '0';
        row[fieldKey] = chars.join('');
        input.value = chars.join('');
        input.setSelectionRange(1, 1);
        return;
      } else if (selStart === 1 || selStart === 4 || selStart === 5) {
        event.preventDefault();
        const chars = val.split('');
        const targetIdx = selStart === 5 ? 4 : selStart - 1;
        chars[targetIdx] = '0';
        row[fieldKey] = chars.join('');
        input.value = chars.join('');
        input.setSelectionRange(targetIdx, targetIdx);
        return;
      }
    }
  }

  onTimeInput(event: Event, row: any, fieldKey: string): void {
    const input = event.target as HTMLInputElement;
    let raw = (input.value || '').replace(/[^0-9]/g, '').substring(0, 4);

    if (raw.length === 4) {
      let h = Math.min(parseInt(raw.slice(0, 2), 10), 23);
      let m = Math.min(parseInt(raw.slice(2, 4), 10), 59);
      const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

      row[fieldKey] = formatted;
      input.value = formatted;

      if (!this.validateTimeInterval(row, fieldKey)) {
        input.value = '';
      }
    } else {
      row[fieldKey] = input.value;
    }
  }

  onTimeBlur(event: Event, row: any, fieldKey: string): void {
    const input = event.target as HTMLInputElement;
    const val = (input.value || '').trim();

    if (!val || ['00:00', '00:00:00', '-'].includes(val)) {
      row[fieldKey] = '';
      input.value = '';
      return;
    }

    const digits = val.replace(/[^0-9]/g, '');
    if (digits.length === 0) {
      row[fieldKey] = '';
      input.value = '';
    } else if (digits.length <= 2) {
      let h = Math.min(parseInt(digits, 10), 23);
      const formatted = `${h.toString().padStart(2, '0')}:00`;
      row[fieldKey] = formatted;
      input.value = formatted;
    } else if (digits.length === 3) {
      const h = parseInt(digits.slice(0, 1), 10);
      let m = Math.min(parseInt(digits.slice(1), 10), 59);
      const formatted = `0${h}:${m.toString().padStart(2, '0')}`;
      row[fieldKey] = formatted;
      input.value = formatted;
    } else if (digits.length >= 4) {
      let h = Math.min(parseInt(digits.slice(0, 2), 10), 23);
      let m = Math.min(parseInt(digits.slice(2, 4), 10), 59);
      const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      row[fieldKey] = formatted;
      input.value = formatted;
    }
    if (!this.validateTimeInterval(row, fieldKey)) {
      input.value = '';
    }
  }

  isValidTime(val: string | null | undefined): boolean {
    if (!val || typeof val !== 'string') return false;
    const trimmed = val.trim();
    // Tam bir saat formatı mı kontrol et (Örn: 08:30, 15:45)
    const timeRegex = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
    return timeRegex.test(trimmed) && trimmed !== '00:00';
  }

  private validateTimeInterval(row: any, fieldKey: string): boolean {
    let day = '';
    let isEtut = fieldKey.includes('Etutlu');

    for (const d of this.days) {
      if (fieldKey.startsWith(d.key)) {
        day = d.key;
        break;
      }
    }

    if (!day) return true;

    const basField = isEtut ? `${day}EtutluBas` : `${day}Bas`;
    const bitField = isEtut ? `${day}EtutluBit` : `${day}Bit`;

    const basTime = row[basField];
    const bitTime = row[bitField];

    // İki alan da eksiksiz girilmişse kıyasla
    if (this.isValidTime(basTime) && this.isValidTime(bitTime)) {
      if (basTime >= bitTime) {
        // Hata durumunda bildirim ver ve son girilen hatalı alanı temizle
        this.notification.error(
          `${day} ${isEtut ? 'Etüt' : 'Normal'} bitiş saati, başlangıç saatinden ileri (büyük) olmalıdır.`,
        );
        row[fieldKey] = '';
        this.cdr.markForCheck();
        return false;
      }
    }

    return true;
  }

  hasNormalTime(row: any, dayKey: string): boolean {
    return this.isValidTime(row[dayKey + 'Bas']) && this.isValidTime(row[dayKey + 'Bit']);
  }

  hasStudyTime(row: any, dayKey: string): boolean {
    return (
      this.isValidTime(row[dayKey + 'EtutluBas']) && this.isValidTime(row[dayKey + 'EtutluBit'])
    );
  }

  hasAnyStudyTime(row: any): boolean {
    return this.days.some((day) => this.hasStudyTime(row, day.key));
  }
}
