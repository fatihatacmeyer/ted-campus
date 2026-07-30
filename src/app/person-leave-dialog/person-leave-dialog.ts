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
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import {
  Person,
  PersonLeaveAssignParams,
  LeaveType,
  OperationResultResponse,
} from '../core/person.model';
import { PersonService } from '../services/person.service';
import { TypesService, DropdownItem } from '../services/types.service';

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
  ],
  templateUrl: './person-leave-dialog.html',
  styleUrl: './person-leave-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonLeaveDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() person: Person | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<void>();

  private personService = inject(PersonService);
  private typesService = inject(TypesService);
  private cdr = inject(ChangeDetectorRef);

  selectedDate: Date | null = null;
  selectedLeaveType: number | null = null;
  startTime = '';
  endTime = '';
  description = '';
  isProcessing = false;
  errorMessage = '';
  leaveTypes: LeaveType[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.resetForm();
      this.loadLeaveTypes();
    }
  }

  private resetForm(): void {
    this.errorMessage = '';
    this.selectedDate = new Date();
    this.selectedLeaveType = null;
    this.startTime = '';
    this.endTime = '';
    this.description = '';
    this.isProcessing = false;
  }

  private loadLeaveTypes(): void {
    this.typesService.getDropdownList('izintipleri').subscribe({
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
    if (!this.person) return 'İzin Ata';
    return `İzin Ata — ${this.person.ad} ${this.person.soyad}`;
  }

  get isFormValid(): boolean {
    if (!this.selectedDate) return false;
    if (this.selectedLeaveType == null) return false;
    if (!this.startTime || !this.endTime) return false;
    return true;
  }

  // Legacy uyumu: "2026-07-29" — T00:00:00 EKLENMEDEN, birebir aynı format
  private formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  }

  onConfirm(): void {
    if (!this.person || !this.isFormValid) return;

    this.isProcessing = true;
    this.errorMessage = '';

    const dateISO = this.formatDate(this.selectedDate!);
    const extra = JSON.stringify([
      {
        sicilid: this.person.id,
        tarih: dateISO,
        tarihbit: dateISO,
      },
    ]);

    const request: PersonLeaveAssignParams = {
      islemtipi: 'ik',
      extra,
      tip: this.selectedLeaveType!,
      saatbas: this.startTime,
      saatbit: this.endTime,
      ucretli: false,
      saatlik: true,
      aciklama: this.description || '',
      sicilid: 0,
      tarih: 'undefined',
      tarihbit: 'undefined',
    };

    this.personService.assignLeave(request).subscribe({
      next: (response: OperationResultResponse[]) => {
        this.isProcessing = false;

        const result = response[0];
        if (!result) {
          this.errorMessage = 'Sunucudan geçerli bir yanıt alınamadı.';
          this.cdr.markForCheck();
          return;
        }

        if (result.islemsonuc === '1' || result.islemsonuc === 1) {
          this.confirmed.emit();
          this.close();
        } else {
          this.errorMessage = result.sunucucevap || 'İzin kaydedilemedi.';
          this.cdr.markForCheck();
        }
      },
      error: (err: unknown) => {
        this.isProcessing = false;
        this.errorMessage =
          'Bir hata oluştu: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata');
        this.cdr.markForCheck();
      },
    });
  }

  close(): void {
    this.visibleChange.emit(false);
  }
}
