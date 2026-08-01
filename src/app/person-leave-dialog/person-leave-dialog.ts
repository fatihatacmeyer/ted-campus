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
import { CheckboxModule } from 'primeng/checkbox';
import { Person, PersonLeaveAssignCampusParams, LeaveType } from '../core/person.model';
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
    CheckboxModule,
  ],
  templateUrl: './person-leave-dialog.html',
  styleUrl: './person-leave-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonLeaveDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() person: Person | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<string>();

  private personService = inject(PersonService);
  private typesService = inject(TypesService);
  private cdr = inject(ChangeDetectorRef);

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
    }
  }

  private resetForm(): void {
    const today = new Date();
    this.errorMessage = '';
    this.startDateStr = this.formatDate(today);
    this.endDateStr = this.formatDate(today);
    this.selectedLeaveType = null;
    this.startTime = '';
    this.endTime = '';
    this.description = '';
    this.isProcessing = false;
    this.isBlok = true;
    this.isSaatlik = false;
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
    if (!this.startDateStr) return false;
    if (!this.endDateStr) return false;
    if (this.selectedLeaveType == null) return false;
    return true;
  }

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

    const basSaat = this.startTime || '00:00';
    const bitSaat = this.endTime || '00:00';
    const bastarih = `${this.startDateStr}T${basSaat}`;
    const bittarih = `${this.endDateStr}T${bitSaat}`;

    const request: PersonLeaveAssignCampusParams = {
      sicilid: this.person.id,
      tip: this.selectedLeaveType!,
      bastarih,
      bittarih,
      saatlikmi: this.isSaatlik ? 1 : 0,
      aciklama: (this.description || '').trim(),
      blok: this.isBlok ? 1 : 0,
    };

    this.personService.assignLeaveCampus(request).subscribe({
      next: (response: unknown) => {
        this.isProcessing = false;

        // /Dynamic response'u array olarak gelir; başarı = islemsonuc "1"
        const items = Array.isArray(response) ? response : [response];
        const result = items[0] as Record<string, unknown> | undefined;

        if (!result) {
          this.errorMessage = 'Sunucudan geçerli bir yanıt alınamadı.';
          this.cdr.markForCheck();
          return;
        }

        const sonuc = String(result['Sonuc'] ?? '');
        if (sonuc === '1') {
          const successMessage = (result['SunucuCevap'] as string) || 'İzin başarıyla atandı.';
          this.confirmed.emit(successMessage);
          this.close();
        } else {
          this.errorMessage = (result['SunucuCevap'] as string) || 'İzin kaydedilemedi.';
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
