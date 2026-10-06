import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import {
  Person,
  PersonLeaveAssignCampusParams,
  LeaveType,
} from '../../../../core/models/person.model';
import { PersonService } from '../../services/person.service';
import { TypesService, DropdownItem } from '../../services/types.service';
import { formatDate } from '../../../../shared/utils/date.utils';
import { unwrapResponse } from '../../../../shared/utils/response.utils';
import { concat, forkJoin, last, of } from 'rxjs';
import { AttendanceService } from '../../../attendance/services/attendance.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-person-leave-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    CheckboxModule,
    TranslatePipe,
  ],
  templateUrl: './person-leave-dialog.html',
  styleUrl: './person-leave-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonLeaveDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() person: Person | null = null;

  @Input() multiPersons: { id: number; adSoyad: string }[] = [];

  /** Doluysa dialog düzenleme modunda çalışır: önce bu izin silinir, sonra yenisi eklenir. */
  @Input() replaceLeaveId: number | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<string>();

  private personService = inject(PersonService);
  private typesService = inject(TypesService);
  private attendanceService = inject(AttendanceService);
  private cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);

  startDateStr = '';
  endDateStr = '';
  selectedLeaveType: number | null = null;
  startTime = '';
  endTime = '';
  description = '';
  isProcessing = false;
  errorMessage = '';
  leaveTypes: LeaveType[] = [];
  isBlok = true; // varsayılan: blok izin
  isSaatlik = false; // varsayılan: tüm gün

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.resetForm();
      this.loadLeaveTypes();
      this.loadTerminals(); // ← YENİ
    }
  }

  selectedTerminal: number | null = null;
  terminals: DropdownItem[] = []; // artık boş başlıyor, backend'den dolduruluyor

  /** sp_MeCampusterminal_s'ten çıkış terminali (kapı) listesini çeker. */
  private loadTerminals(): void {
    this.typesService
      .getTerminals()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items: DropdownItem[]) => {
          this.terminals = items; // Dropdown'ı besleyen dizi
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[PersonLeaveDialog] Terminaller yüklenirken hata:', err);
          this.terminals = [];
          this.cdr.markForCheck();
        },
      });
  }
  private getTimeString(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private resetForm(): void {
    const today = new Date();
    const defaultEndTime = new Date(today.getTime() + 15 * 60 * 1000);

    this.errorMessage = '';
    this.startDateStr = formatDate(today);
    this.endDateStr = formatDate(today);
    this.selectedLeaveType = null;
    this.selectedTerminal = null;
    this.startTime = this.getTimeString(today);
    this.endTime = this.getTimeString(defaultEndTime);
    this.description = '';
    this.isProcessing = false;
    this.isBlok = false;
    this.isSaatlik = true;
  }

  private loadLeaveTypes(): void {
    this.typesService
      .getDropdownList('izintipleri')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items: DropdownItem[]) => {
          this.leaveTypes = items.map((item) => ({ id: item.id, ad: item.ad }));
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('[PersonLeaveDialog] İzin tipleri yüklenirken hata:', err);
          this.leaveTypes = [];
          this.cdr.markForCheck();
        },
      });
  }

  get dialogTitle(): string {
    if (this.replaceLeaveId != null) {
      const name = this.multiPersons[0]?.adSoyad;
      return name
        ? this.translate.instant('PERSON_LEAVE.TITLE_EDIT_NAME', { name })
        : this.translate.instant('PERSON_LEAVE.TITLE_EDIT');
    }
    if (this.multiPersons && this.multiPersons.length > 0) {
      return this.translate.instant('PERSON_LEAVE.TITLE_BULK', { count: this.multiPersons.length });
    }
    if (!this.person) return this.translate.instant('PERSON_LEAVE.TITLE_ASSIGN');
    return this.translate.instant('PERSON_LEAVE.TITLE_ASSIGN_NAME', {
      name: `${this.person.ad} ${this.person.soyad}`,
    });
  }

  get isFormValid(): boolean {
    if (!this.startDateStr) return false;
    if (!this.endDateStr) return false;
    if (this.selectedLeaveType == null) return false;
    if (this.selectedTerminal == null) return false;
    return true;
  }

  onConfirm(): void {
    if (
      (!this.person && (!this.multiPersons || this.multiPersons.length === 0)) ||
      !this.isFormValid
    )
      return;

    this.isProcessing = true;
    this.errorMessage = '';

    const basSaat = this.startTime || '00:00';
    const bitSaat = this.endTime || '00:00';
    const bastarih = `${this.startDateStr}T${basSaat}`;
    const bittarih = `${this.endDateStr}T${bitSaat}`;

    // Hedef sicil ID'lerini belirle (Çoklu liste doluysa onları, yoksa tekil personeli al)
    const targets =
      this.multiPersons && this.multiPersons.length > 0
        ? this.multiPersons.map((p) => p.id)
        : [this.person!.id];

    // Her bir sicil için ayrı bir backend isteği hazırla
    const requests = targets.map((sicilid) => {
      const request: PersonLeaveAssignCampusParams = {
        sicilid,
        tip: this.selectedLeaveType!,
        bastarih,
        bittarih,
        saatlikmi: this.isSaatlik ? 1 : 0,
        aciklama: (this.description || '').trim(),
        blok: this.isBlok ? 1 : 0,
        kapi: this.selectedTerminal!,
      };
      return this.personService.assignLeaveCampus(request);
    });

    // Düzenleme modunda: önce mevcut izin silinir, ardından yeni izin(ler) eklenir.
    // Silme başarısız olursa ekleme hiç yapılmaz.
    const deleteStep$ =
      this.replaceLeaveId != null
        ? this.attendanceService.deleteStudentLeave(this.replaceLeaveId)
        : of(null);

    concat(deleteStep$.pipe(last()), forkJoin(requests))
      .pipe(last())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const responses = res as unknown[];
          this.isProcessing = false;

          // Tüm yanıtların başarılı (Sonuc === '1') olup olmadığını kontrol et
          const allSuccess = responses.every((res) => {
            const result = unwrapResponse<Record<string, unknown>>(
              res as Record<string, unknown> | null | undefined,
            );
            return result && String(result['Sonuc'] ?? '') === '1';
          });

          if (allSuccess) {
            this.confirmed.emit(
              this.replaceLeaveId != null
                ? 'PERSON_LEAVE.MSG_UPDATED'
                : 'PERSON_LEAVE.MSG_ASSIGNED',
            );
            this.close();
          } else {
            this.errorMessage = this.translate.instant('PERSON_LEAVE.ERR_PARTIAL');
            this.cdr.markForCheck();
          }
        },
        error: (err: unknown) => {
          this.isProcessing = false;
          this.errorMessage = this.translate.instant('COMMON.ERROR_OCCURRED', {
            message:
              err instanceof Error ? err.message : this.translate.instant('COMMON.UNKNOWN_ERROR'),
          });
          this.cdr.markForCheck();
        },
      });
  }

  close(): void {
    this.visibleChange.emit(false);
  }
}
