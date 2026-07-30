import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { Person, ExitReason, OperationResultResponse } from '../core/person.model';
import { PersonService } from '../services/person.service';

@Component({
  selector: 'app-person-exit-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, DatePickerModule, SelectModule],
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
        this.displayTitle = 'Kişiyi İşten Çıkar';
        this.loadReasons();
      } else {
        this.displayTitle = 'Kişiyi İşe Geri Al';
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
    this.personService.getExitReasons().subscribe({
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
          { label: 'Neden 1', value: 1 },
          { label: 'Neden 2', value: 2 },
          { label: 'Neden 3', value: 3 },
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
        .subscribe({
          next: (response: unknown) => {
            this.isProcessing = false;
            const result = (
              Array.isArray(response) ? response[0] : response
            ) as OperationResultResponse;
            if (result?.islemsonuc == '1' || result?.islemsonuc == 1) {
              this.confirmed.emit();
              this.close();
            } else {
              this.errorMessage = 'İşlem başarısız oldu. Lütfen tekrar deneyin.';
            }
          },
          error: (err: unknown) => {
            this.isProcessing = false;
            this.errorMessage =
              'Bir hata oluştu: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata');
          },
        });
    } else {
      this.personService.restorePerson(this.person.id, formattedDate).subscribe({
        next: (response: unknown) => {
          this.isProcessing = false;
          const result = (
            Array.isArray(response) ? response[0] : response
          ) as OperationResultResponse;
          if (result?.islemsonuc == '1' || result?.islemsonuc == 1) {
            this.confirmed.emit();
            this.close();
          } else {
            this.errorMessage = 'İşlem başarısız oldu. Lütfen tekrar deneyin.';
          }
        },
        error: (err: unknown) => {
          this.isProcessing = false;
          this.errorMessage =
            'Bir hata oluştu: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata');
        },
      });
    }
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
