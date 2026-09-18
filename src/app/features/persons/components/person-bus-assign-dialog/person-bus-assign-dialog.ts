import {
  Component,
  ChangeDetectionStrategy,
  EventEmitter,
  Input,
  Output,
  OnInit,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { Person } from '../../../../core/models/person.model';
import { SchoolBusService } from '../../../transport/services/school-bus.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-person-bus-assign-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, SelectModule],
  templateUrl: './person-bus-assign-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonBusAssignDialogComponent implements OnInit {
  @Input() visible = false;
  @Input() person: Person | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<void>();

  private busService = inject(SchoolBusService);
  private notification = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);

  busOptions: { label: string; value: number }[] = [];
  selectedBusId: number | null = null;
  selectedYon: number = 1; // Varsayılan Gidiş

  yonOptions = [
    { label: 'Gidiş', value: 1 },
    { label: 'Dönüş', value: 2 },
    { label: 'Gidiş ve Dönüş', value: 3 },
  ];

  isProcessing = false;

  ngOnInit() {
    this.busService.getBuses().subscribe((buses) => {
      this.busOptions = buses.map((b) => ({
        label: `${b.plate} - ${b.brand} ${b.model} (Boş Koltuk: Gidiş ${b.bosKoltukGidis}, Dönüş ${b.bosKoltukDonus})`,
        value: b.id,
      }));
      this.cdr.markForCheck();
    });
  }

  close() {
    this.visibleChange.emit(false);
    this.selectedBusId = null;
    this.selectedYon = 1;
  }

  onConfirm() {
    if (!this.person || !this.selectedBusId) return;

    this.isProcessing = true;
    const ogrenciSicilId = this.person.id;
    const servisId = this.selectedBusId;
    const yon = this.selectedYon;

    // Gidiş ve Dönüş (3) seçildiyse iki isteği aynı anda gönderiyoruz
    if (yon === 3) {
      forkJoin([
        this.busService.assignStudentToBus(ogrenciSicilId, servisId, 1),
        this.busService.assignStudentToBus(ogrenciSicilId, servisId, 2),
      ]).subscribe({
        next: (results) => {
          this.isProcessing = false;

          const gidisRes = results[0];
          const donusRes = results[1];

          // İkisi de başarılıysa
          if (gidisRes.sonuc === 1 && donusRes.sonuc === 1) {
            this.notification.success('Öğrenci hem gidiş hem dönüş için servise atandı.');
            this.confirmed.emit();
            this.close();
          } else {
            // Hata olan yönlerin mesajlarını birleştir ve göster
            const errorMessages = [];
            if (gidisRes.sonuc !== 1) {
              errorMessages.push(`Gidiş: ${gidisRes.sunucuCevap || 'Hata'}`);
            }
            if (donusRes.sonuc !== 1) {
              errorMessages.push(`Dönüş: ${donusRes.sunucuCevap || 'Hata'}`);
            }

            // Kullanıcıya tam olarak sunucunun döndüğü metinleri (Örn: "Bu öğrenci bu yön için zaten bir servise atanmış") gösteriyoruz
            this.notification.error(errorMessages.join(' | '));
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.isProcessing = false;
          this.notification.error('Sunucuyla iletişim kurulurken bir hata oluştu.');
          this.cdr.markForCheck();
        },
      });
    } else {
      // Sadece Gidiş (1) veya sadece Dönüş (2)
      this.busService.assignStudentToBus(ogrenciSicilId, servisId, yon as 1 | 2).subscribe({
        next: (res) => {
          this.isProcessing = false;
          if (res.sonuc === 1) {
            this.notification.success('Öğrenci servise başarıyla atandı.');
            this.confirmed.emit();
            this.close();
          } else {
            // Doğrudan backend'den gelen "Bu öğrenci bu yön için zaten bir servise atanmış" mesajı gösterilecek
            this.notification.error(res.sunucuCevap || 'Atama işlemi sırasında bir hata oluştu.');
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.isProcessing = false;
          this.notification.error('Sunucuyla iletişim kurulurken bir hata oluştu.');
          this.cdr.markForCheck();
        },
      });
    }
  }
}
