import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { NotificationService } from '../../../../core/services/notification.service';
import { isIntervalValid, isValidTime } from '../../../../shared/utils/time.utils';
import { TimeRangeInputComponent } from '../time-range-input/time-range-input';

/**
 * Bir sınıfın bir gününe ait "Normal" ve "Etüt" saat çiftini gösterir/düzenler.
 * Orijinal component'te tek bir @for bloğunun içinde ~90 satır tutan bu mantık
 * artık kendi kapsülünde, bağımsız test edilebilir bir bileşen.
 */
@Component({
  selector: 'app-day-hours-cell',
  standalone: true,
  imports: [TimeRangeInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-hours-cell.html',
  styleUrl: './day-hours-cell.scss',
})
export class DayHoursCellComponent {
  private readonly notification = inject(NotificationService);

  readonly editing = input(false);
  readonly dayName = input.required<string>();
  readonly normalHint = input('');
  readonly studyHint = input('');

  readonly normalStart = model<string | undefined>();
  readonly normalEnd = model<string | undefined>();
  readonly studyStart = model<string | undefined>();
  readonly studyEnd = model<string | undefined>();

  readonly hasNormalTime = computed(
    () => isValidTime(this.normalStart()) && isValidTime(this.normalEnd()),
  );
  readonly hasStudyTime = computed(
    () => isValidTime(this.studyStart()) && isValidTime(this.studyEnd()),
  );

  /**
   * Bir çiftin (normal ya da etüt) başlangıç/bitişi tamamlandığında çağrılır.
   * Geçersizse (bitiş <= başlangıç) kullanıcı bilgilendirilir ve bitiş alanı temizlenir.
   */
  checkInterval(pair: 'normal' | 'study'): void {
    const [start, end, label] =
      pair === 'normal'
        ? ([this.normalStart, this.normalEnd, 'Normal'] as const)
        : ([this.studyStart, this.studyEnd, 'Etüt'] as const);

    if (!isIntervalValid(start(), end())) {
      this.notification.error(
        `${this.dayName()} ${label} bitiş saati, başlangıç saatinden ileri (büyük) olmalıdır.`,
      );
      end.set(undefined);
    }
  }
}
