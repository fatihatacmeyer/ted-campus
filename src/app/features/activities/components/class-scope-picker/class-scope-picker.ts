import { Component, inject, input } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CheckboxModule } from 'primeng/checkbox';
import { MultiSelectModule } from 'primeng/multiselect';

import { ClassGroup } from '../../services/activity-lookups.service';

/**
 * Etkinliğin sınıf kapsamı seçicisi: "Tüm şubeleri seç / Temizle" kısayolları, seçim özeti ve
 * seviye başlıklı çoklu seçim. Değer, seçili sınıf adlarının dizisidir (`control` üzerinde tutulur).
 *
 * Form değerleri dışarıdan (üst formun `patchValue`'su) değiştiği için varsayılan değişiklik
 * algılama kullanılır; OnPush olsaydı özet ve onay kutuları eski değerde kalırdı.
 */
@Component({
  selector: 'app-class-scope-picker',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TranslatePipe, CheckboxModule, MultiSelectModule],
  templateUrl: './class-scope-picker.html',
  styleUrl: './class-scope-picker.scss',
})
export class ClassScopePickerComponent {
  readonly control = input.required<FormControl<string[] | null>>();
  readonly groups = input.required<ClassGroup[]>();
  /** Doğrulama hatası gösterimi (dokunulmuş ve geçersiz). */
  readonly invalid = input(false);

  private readonly translate = inject(TranslateService);

  private get selected(): string[] {
    return this.control().value || [];
  }

  /** Grubun tüm şubeleri seçili mi? */
  isGroupSelected(group: ClassGroup): boolean {
    return (
      group.items.length > 0 && group.items.every((item) => this.selected.includes(item.value))
    );
  }

  /** Grup içindeki şubelerin bir kısmı mı seçili? (Indeterminate checkbox durumu için) */
  isGroupIndeterminate(group: ClassGroup): boolean {
    const selectedCount = this.getGroupSelectedCount(group);
    return selectedCount > 0 && selectedCount < group.items.length;
  }

  /** Grup içinde kaç şube seçili? */
  getGroupSelectedCount(group: ClassGroup): number {
    return group.items.filter((item) => this.selected.includes(item.value)).length;
  }

  /** Toplam sınıf sayısı */
  get allClassesCount(): number {
    return this.groups().reduce((sum, group) => sum + group.items.length, 0);
  }

  /** Tüm sınıflar seçili mi? */
  get isAllClassesSelected(): boolean {
    if (this.allClassesCount === 0) return false;
    return this.selected.length === this.allClassesCount;
  }

  /** Tüm sınıfları seç */
  selectAllClasses(): void {
    this.setSelection(this.groups().flatMap((g) => g.items.map((i) => i.value)));
  }

  /** Seçimi temizle */
  clearAllClasses(): void {
    this.setSelection([]);
  }

  /** Seçim özeti string */
  get getSelectionSummary(): string {
    const selected = this.selected;
    if (selected.length === 0) return '';
    if (this.isAllClassesSelected) {
      return this.translate.instant('ACTIVITIES.ALL_CLASSES_SELECTED', {
        count: this.allClassesCount,
      });
    }

    const parts: string[] = [];
    for (const group of this.groups()) {
      const count = group.items.filter((item) => selected.includes(item.value)).length;
      if (count > 0) {
        parts.push(`${group.label} (${count}/${group.items.length})`);
      }
    }
    return parts.join(', ');
  }

  /** Grubu aç/kapat: hepsi seçiliyse kaldır, değilse hepsini ekle */
  toggleGroup(group: ClassGroup): void {
    const current = this.selected;
    const groupValues = new Set(group.items.map((i) => i.value));

    if (this.isGroupSelected(group)) {
      // Tümünü kaldır
      this.setSelection(current.filter((v) => !groupValues.has(v)));
    } else {
      // Tümünü ekle
      this.setSelection([...new Set([...current, ...group.items.map((i) => i.value)])]);
    }
  }

  private setSelection(values: string[]): void {
    const ctrl = this.control();
    ctrl.setValue(values);
    ctrl.markAsDirty();
  }
}
