import {
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';

import { NotificationService } from '../../../../core/services/notification.service';
import { SchoolHoursService } from '../../services/school-hours.service';
import { SchoolHours } from '../../models/school-hours.model';

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
  ],
  providers: [ConfirmationService],
  templateUrl: './school-hours-list.html',
  styleUrl: './school-hours-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchoolHoursListComponent implements OnInit {
  hours: SchoolHours[] = [];
  loading = false;

  // İptal durumunda eski haline çevirebilmek için orijinal verileri tutar
  clonedHours: { [s: number]: SchoolHours } = {};

  // Tablo sütunlarını döngüye alabilmek için tanımladık
  days = [
    { key: 'Pazartesi', header: 'Pazartesi' },
    { key: 'Sali', header: 'Salı' },
    { key: 'Carsamba', header: 'Çarşamba' },
    { key: 'Persembe', header: 'Perşembe' },
    { key: 'Cuma', header: 'Cuma' },
    { key: 'Cumartesi', header: 'Cumartesi' },
    { key: 'Pazar', header: 'Pazar' },
  ];

  private schoolHoursService = inject(SchoolHoursService);
  private confirmationService = inject(ConfirmationService);
  private notification = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.schoolHoursService.getSchoolHours().subscribe({
      next: (data) => {
        this.hours = [...data];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.notification.error('Saat bilgileri yüklenirken bir hata oluştu.');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  // 1. Satır düzenleme başladığında
  onRowEditInit(row: SchoolHours) {
    this.clonedHours[row.Id] = { ...row }; // Orijinal halini kopyala
  }

  // 2. Kullanıcı tik (kaydet) butonuna bastığında
  onRowEditSave(row: SchoolHours) {
    const original = this.clonedHours[row.Id];

    // Verilerde gerçekten bir değişiklik var mı kontrol edelim
    const hasChanges = JSON.stringify(original) !== JSON.stringify(row);

    if (!hasChanges) {
      delete this.clonedHours[row.Id]; // Değişiklik yoksa sessizce moddan çık
      return;
    }

    // Değişiklik varsa onay penceresini aç
    this.confirmationService.confirm({
      message: `<b>${row.SinifSeviyesi}</b> saatlerinde yaptığınız değişiklikleri kaydetmek istediğinize emin misiniz?`,
      header: 'Değişiklikleri Onayla',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Evet, Kaydet',
      rejectLabel: 'Vazgeç',
      acceptButtonStyleClass: 'p-button-success',
      rejectButtonStyleClass: 'p-button-text p-button-danger',
      accept: () => {
        this.updateRow(row);
      },
      reject: () => {
        this.revertRow(row);
      },
    });
  }

  // 3. Kullanıcı çarpı (iptal) butonuna bastığında
  onRowEditCancel(row: SchoolHours, index: number) {
    this.revertRow(row);
  }

  // Veritabanına güncelleme isteği atar
  private updateRow(row: SchoolHours) {
    this.loading = true;
    this.cdr.markForCheck();

    this.schoolHoursService.updateSchoolHours(row).subscribe({
      next: (res) => {
        if (res.sonuc === 1 || res.sonuc === 0) {
          this.notification.success(res.sunucuCevap || 'Saatler başarıyla güncellendi.');
          delete this.clonedHours[row.Id];
          this.loadData();
        } else {
          this.notification.error(res.sunucuCevap || 'Güncelleme sırasında hata oluştu.');
          this.revertRow(row);
          this.loading = false;
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.notification.error('Sunucuyla iletişim hatası.');
        this.revertRow(row);
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  // Satırı düzenleme başlamadan önceki orijinal haline döndürür
  private revertRow(row: SchoolHours) {
    const index = this.hours.findIndex((h) => h.Id === row.Id);
    if (index !== -1) {
      this.hours[index] = this.clonedHours[row.Id];
    }
    delete this.clonedHours[row.Id];
    this.cdr.markForCheck();
  }

  onTimeFocus(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    input.select();
  }

  onTimeKeyDown(event: KeyboardEvent, row: any, fieldKey: string): void {
    const input = event.target as HTMLInputElement;
    const key = event.key;

    // Allow navigation and system shortcuts
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      key === 'Tab' ||
      key === 'Enter' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === 'Home' ||
      key === 'End'
    ) {
      return;
    }

    const val = input.value || '';
    const selStart = input.selectionStart ?? 0;
    const selEnd = input.selectionEnd ?? 0;
    const hasSelection = selEnd > selStart;

    // Typing numbers 0-9
    if (/^[0-9]$/.test(key)) {
      if (hasSelection) {
        return; // normal replace of selected text
      }

      // If already in XX:XX mask structure (length 5)
      if (val.length === 5 && val[2] === ':') {
        event.preventDefault();
        const chars = val.split('');
        let nextCursor = selStart;

        if (selStart === 0) {
          chars[0] = key;
          nextCursor = 1;
        } else if (selStart === 1) {
          chars[1] = key;
          nextCursor = 3; // jump over ':'
        } else if (selStart === 2) {
          chars[3] = key;
          nextCursor = 4;
        } else if (selStart === 3) {
          chars[3] = key;
          nextCursor = 4;
        } else if (selStart === 4) {
          chars[4] = key;
          nextCursor = 5;
        } else {
          return;
        }

        const newVal = chars.join('');
        row[fieldKey] = newVal;
        input.value = newVal;
        input.setSelectionRange(nextCursor, nextCursor);
        return;
      }
    }

    // Backspace handling
    if (key === 'Backspace' && !hasSelection && val.length === 5 && val[2] === ':') {
      if (selStart === 3) {
        // Cursor immediately after ':', delete digit before ':' (index 1)
        event.preventDefault();
        const chars = val.split('');
        chars[1] = '0';
        const newVal = chars.join('');
        row[fieldKey] = newVal;
        input.value = newVal;
        input.setSelectionRange(1, 1);
        return;
      } else if (selStart === 1 || selStart === 4 || selStart === 5) {
        event.preventDefault();
        const chars = val.split('');
        const targetIdx = selStart === 5 ? 4 : selStart - 1;
        chars[targetIdx] = '0';
        const newVal = chars.join('');
        row[fieldKey] = newVal;
        input.value = newVal;
        input.setSelectionRange(targetIdx, targetIdx);
        return;
      }
    }
  }

  onTimeInput(event: Event, row: any, fieldKey: string): void {
    const input = event.target as HTMLInputElement;
    let raw = (input.value || '').replace(/[^0-9]/g, '');

    if (raw.length > 4) {
      raw = raw.substring(0, 4);
    }

    if (raw.length === 4) {
      let h = parseInt(raw.slice(0, 2), 10);
      let m = parseInt(raw.slice(2, 4), 10);
      if (h > 23) h = 23;
      if (m > 59) m = 59;
      const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      row[fieldKey] = formatted;
      input.value = formatted;
    } else {
      row[fieldKey] = input.value;
    }
  }

  onTimeBlur(event: Event, row: any, fieldKey: string): void {
    const input = event.target as HTMLInputElement;
    const val = (input.value || '').trim();

    if (!val || val === '00:00' || val === '00:00:00' || val === '-') {
      row[fieldKey] = '';
      input.value = '';
      return;
    }

    const digits = val.replace(/[^0-9]/g, '');

    if (digits.length === 0) {
      row[fieldKey] = '';
      input.value = '';
    } else if (digits.length === 1 || digits.length === 2) {
      let h = parseInt(digits, 10);
      if (h > 23) h = 23;
      const formatted = `${h.toString().padStart(2, '0')}:00`;
      row[fieldKey] = formatted;
      input.value = formatted;
    } else if (digits.length === 3) {
      const h = parseInt(digits.slice(0, 1), 10);
      let m = parseInt(digits.slice(1), 10);
      if (m > 59) m = 59;
      const formatted = `0${h}:${m.toString().padStart(2, '0')}`;
      row[fieldKey] = formatted;
      input.value = formatted;
    } else if (digits.length >= 4) {
      let h = parseInt(digits.slice(0, 2), 10);
      let m = parseInt(digits.slice(2, 4), 10);
      if (h > 23) h = 23;
      if (m > 59) m = 59;
      const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      row[fieldKey] = formatted;
      input.value = formatted;
    }
  }

  private isValidTime(val: string | null | undefined): boolean {
    if (!val || typeof val !== 'string') return false;
    const trimmed = val.trim();
    return (
      trimmed !== '' &&
      trimmed !== '00:00' &&
      trimmed !== '00:00:00' &&
      trimmed !== '0:00' &&
      trimmed !== '-'
    );
  }

  // Ekranda okunabilir (Excel'deki gibi flat) formatta HTML döndürür
  formatDay(row: any, dayKey: string): string {
    const bas = row[dayKey + 'Bas'];
    const bit = row[dayKey + 'Bit'];
    const eBas = row[dayKey + 'EtutluBas'];
    const eBit = row[dayKey + 'EtutluBit'];

    const hasNormal = this.isValidTime(bas) && this.isValidTime(bit);
    const hasEtut = this.isValidTime(eBas) && this.isValidTime(eBit);

    let output = '';

    // Normal Saatler
    if (hasNormal) {
      output += `<div class="normal-time">${bas} - ${bit}</div>`;
    }

    // Etütlü Saatler (Sadece geçerli saat girilmişse ve 00:00 değilse gösterilir)
    if (hasEtut) {
      output += `<div class="etut-time" style="font-size: 0.75rem; color: #6b7280; margin-top: 2px;">(Etüt: ${eBas} - ${eBit})</div>`;
    }

    // Hiç saat yoksa Kapalı göster
    if (!output) {
      output = '<span style="color: #9ca3af; font-size: 0.8rem; font-style: italic;">Kapalı</span>';
    }

    return output;
  }
}
