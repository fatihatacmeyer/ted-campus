import { ChangeDetectionStrategy, Component, model, output } from '@angular/core';
import {
  applyBackspaceAtCaret,
  applyDigitAtCaret,
  finalizeTimeValue,
} from '../../../../shared/utils/time.utils';

@Component({
  selector: 'app-time-range-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './time-range-input.html',
  styleUrl: './time-range-input.scss',
})
export class TimeRangeInputComponent {
  readonly value = model<string | undefined>();
  readonly ariaLabel = model<string>('saat');

  readonly finalized = output<void>();

  onFocus(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  onKeyDown(event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;
    const key = event.key;

    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      ['Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)
    ) {
      return;
    }

    const val = input.value || '';
    const selStart = input.selectionStart ?? 0;
    const selEnd = input.selectionEnd ?? 0;
    const hasSelection = selEnd > selStart;

    if (/^[0-9]$/.test(key) && !hasSelection) {
      const edit = applyDigitAtCaret(val, selStart, key);
      if (edit) {
        event.preventDefault();
        this.commit(input, edit.value, edit.caret);
      }
      return;
    }

    if (key === 'Backspace' && !hasSelection) {
      const edit = applyBackspaceAtCaret(val, selStart);
      if (edit) {
        event.preventDefault();
        this.commit(input, edit.value, edit.caret);
      }
    }
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = (input.value || '').replace(/[^0-9]/g, '').substring(0, 4);

    if (raw.length === 4) {
      this.commit(input, finalizeTimeValue(raw));
      this.finalized.emit();
    } else {
      this.value.set(input.value);
    }
  }

  onBlur(event: Event): void {
    const input = event.target as HTMLInputElement;
    const finalized = finalizeTimeValue(input.value);
    input.value = finalized;
    this.value.set(finalized || undefined);
    this.finalized.emit();
  }

  private commit(input: HTMLInputElement, value: string, caret?: number): void {
    input.value = value;
    this.value.set(value || undefined);
    const pos = caret ?? value.length;
    input.setSelectionRange(pos, pos);
  }
}
