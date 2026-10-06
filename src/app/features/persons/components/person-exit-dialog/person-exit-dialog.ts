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
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { Person, ExitReason, OperationResultResponse } from '../../../../core/models/person.model';
import { PersonService } from '../../services/person.service';
import { unwrapResponse, isSuccessResult } from '../../../../shared/utils/response.utils';
import { NotificationService } from '../../../../core/services/notification.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-person-exit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    DatePickerModule,
    SelectModule,
    TranslatePipe,
  ],
  templateUrl: './person-exit-dialog.html',
  styleUrl: './person-exit-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonExitDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() person: Person | null = null;
  @Input() mode: 'exit' | 'restore' = 'exit';
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<void>();

  private personService = inject(PersonService);
  private cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);

  displayTitle = '';
  selectedDate: Date | null = null;
  selectedReason: { label: string; value: number } | null = null;
  reasonOptions: { label: string; value: number }[] = [];
  isProcessing = false;
  errorMessage = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.errorMessage = '';
      this.selectedDate = new Date();
      this.selectedReason = null;

      if (this.mode === 'exit') {
        this.displayTitle = this.translate.instant('PERSON_EXIT.TITLE_EXIT');
        this.loadReasons();
      } else {
        this.displayTitle = this.translate.instant('PERSON_EXIT.TITLE_RESTORE');
        this.selectedDate = new Date();
      }
    }
  }

  get dialogTitle(): string {
    if (!this.person) return this.displayTitle;
    return `${this.displayTitle} — ${this.person.ad} ${this.person.soyad}`;
  }

  get isFormValid(): boolean {
    if (!this.selectedDate) return false;
    if (this.mode === 'exit' && (this.selectedReason === null || this.selectedReason === undefined))
      return false;
    return true;
  }

  private loadReasons(): void {
    this.personService.getExitReasons().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data: ExitReason[]) => {
        this.reasonOptions = data
          .filter((d: ExitReason) => d.tip === 'sys_AyrilisNedeni')
          .map((d: ExitReason) => ({ label: d.ad, value: d.id }));
        this.cdr.markForCheck();
      },
      error: (err: unknown) => {
        console.error('Ayrılış nedenleri yüklenemedi:', err);
        // Fallback options
        this.reasonOptions = [
          { label: this.translate.instant('PERSON_EXIT.REASON_N', { n: 1 }), value: 1 },
          { label: this.translate.instant('PERSON_EXIT.REASON_N', { n: 2 }), value: 2 },
          { label: this.translate.instant('PERSON_EXIT.REASON_N', { n: 3 }), value: 3 },
        ];
        this.cdr.markForCheck();
      },
    });
  }

  private formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  onConfirm(): void {
    if (!this.person || !this.selectedDate || !this.isFormValid) return;

    this.isProcessing = true;
    this.errorMessage = '';

    const formattedDate = this.formatDate(this.selectedDate);

    if (this.mode === 'exit') {
      this.personService
        .terminatePerson([this.person.id], this.selectedReason!.value, formattedDate)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response: unknown) => {
            this.isProcessing = false;
            const result = unwrapResponse<OperationResultResponse>(
              response as OperationResultResponse | OperationResultResponse[] | null | undefined,
            );
            if (isSuccessResult(result)) {
              this.notification.success('NOTIFICATIONS.MESSAGES.RECORD_EXITED');
              this.confirmed.emit();
              this.close();
            } else {
              this.errorMessage = this.translate.instant('COMMON.OPERATION_FAILED');
            }
          },
          error: (err: unknown) => {
            this.isProcessing = false;
            this.errorMessage = this.errorText(err);
          },
        });
    } else {
      this.personService.restorePerson(this.person.id, formattedDate)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response: unknown) => {
            this.isProcessing = false;
            const result = unwrapResponse<OperationResultResponse>(
              response as OperationResultResponse | OperationResultResponse[] | null | undefined,
            );
            if (isSuccessResult(result)) {
              this.notification.success('NOTIFICATIONS.MESSAGES.RECORD_RESTORED');
              this.confirmed.emit();
              this.close();
            } else {
              this.errorMessage = this.translate.instant('COMMON.OPERATION_FAILED');
            }
          },
          error: (err: unknown) => {
            this.isProcessing = false;
            this.errorMessage = this.errorText(err);
          },
        });
    }
  }

  /** Hata nesnesinden kullanıcıya gösterilecek çevrilmiş mesajı üretir. */
  private errorText(err: unknown): string {
    return this.translate.instant('COMMON.ERROR_OCCURRED', {
      message: err instanceof Error ? err.message : this.translate.instant('COMMON.UNKNOWN_ERROR'),
    });
  }

  /** `[innerHTML]` çevirilerinde kullanıcı verisini kaçışlayıp kalın yazar. */
  bold(value: string | null | undefined): string {
    const escaped = String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return `<strong>${escaped}</strong>`;
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
