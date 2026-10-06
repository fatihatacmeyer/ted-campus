import {
  Component,
  ChangeDetectionStrategy,
  EventEmitter,
  Input,
  Output,
  OnInit,
  inject,
  ChangeDetectorRef,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { Person } from '../../../../core/models/person.model';
import { SchoolBusService } from '../../../transport/services/school-bus.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-person-bus-assign-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, SelectModule, TranslatePipe],
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
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  busOptions: { label: string; value: number }[] = [];
  selectedBusId: number | null = null;
  selectedYon: number = 1; // Varsayılan Gidiş

  yonOptions: { label: string; value: number }[] = [];

  isProcessing = false;

  ngOnInit() {
    this.buildYonOptions();
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.buildYonOptions();
      this.cdr.markForCheck();
    });

    this.busService.getBuses().subscribe((buses) => {
      this.busOptions = buses.map((b) => ({
        label: this.translate.instant('PERSON_BUS_ASSIGN.BUS_LABEL', {
          plate: b.plate,
          brand: b.brand,
          model: b.model,
          out: b.bosKoltukGidis,
          back: b.bosKoltukDonus,
        }),
        value: b.id,
      }));
      this.cdr.markForCheck();
    });
  }

  private buildYonOptions(): void {
    this.yonOptions = [
      { label: this.translate.instant('PERSON_BUS_ASSIGN.DIR_OUT'), value: 1 },
      { label: this.translate.instant('PERSON_BUS_ASSIGN.DIR_RETURN'), value: 2 },
      { label: this.translate.instant('PERSON_BUS_ASSIGN.DIR_BOTH'), value: 3 },
    ];
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
            this.notification.success('PERSON_BUS_ASSIGN.MSG_ASSIGNED_BOTH');
            this.confirmed.emit();
            this.close();
          } else {
            // Hata olan yönlerin mesajlarını birleştir ve göster
            const errorMessages = [];
            if (gidisRes.sonuc !== 1) {
              errorMessages.push(
                this.translate.instant('PERSON_BUS_ASSIGN.ERR_OUT', {
                  message: gidisRes.sunucuCevap || this.translate.instant('PERSON_BUS_ASSIGN.ERR_WORD'),
                }),
              );
            }
            if (donusRes.sonuc !== 1) {
              errorMessages.push(
                this.translate.instant('PERSON_BUS_ASSIGN.ERR_RETURN', {
                  message: donusRes.sunucuCevap || this.translate.instant('PERSON_BUS_ASSIGN.ERR_WORD'),
                }),
              );
            }

            // Kullanıcıya tam olarak sunucunun döndüğü metinleri (Örn: "Bu öğrenci bu yön için zaten bir servise atanmış") gösteriyoruz
            this.notification.error(errorMessages.join(' | '));
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.isProcessing = false;
          this.notification.error('COMMON.SERVER_ERROR');
          this.cdr.markForCheck();
        },
      });
    } else {
      // Sadece Gidiş (1) veya sadece Dönüş (2)
      this.busService.assignStudentToBus(ogrenciSicilId, servisId, yon as 1 | 2).subscribe({
        next: (res) => {
          this.isProcessing = false;
          if (res.sonuc === 1) {
            this.notification.success('PERSON_BUS_ASSIGN.MSG_ASSIGNED');
            this.confirmed.emit();
            this.close();
          } else {
            // Doğrudan backend'den gelen "Bu öğrenci bu yön için zaten bir servise atanmış" mesajı gösterilecek
            this.notification.error(res.sunucuCevap || 'PERSON_BUS_ASSIGN.MSG_ASSIGN_ERROR');
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.isProcessing = false;
          this.notification.error('COMMON.SERVER_ERROR');
          this.cdr.markForCheck();
        },
      });
    }
  }
}
