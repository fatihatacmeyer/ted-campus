import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { compareClassNames, parseClassName } from '../../utils/class-name.utils';

export interface ClassItem {
  id: number;
  ad: string;
}

interface ClassGroupView {
  /** Seviye; sayıyla başlamayan sınıflar (ANA, LHZ/A) için null ("Diğer" grubu). */
  grade: number | null;
  items: ClassItem[];
}

/**
 * Seviye başlıklı, aranabilir çoklu sınıf seçici.
 * Değer, seçili sınıf ID'lerinin virgülle birleşik halidir ("69,70,71"); boş seçim undefined.
 * Seçim "Uygula" ile onaylanır; panel Uygula olmadan kapanırsa taslak atılır.
 */
@Component({
  selector: 'app-class-multi-select',
  standalone: true,
  imports: [FormsModule, ButtonModule, CheckboxModule, InputTextModule, TranslatePipe],
  templateUrl: './class-multi-select.html',
  styleUrl: './class-multi-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClassMultiSelectComponent {
  readonly classes = input<ClassItem[]>([]);
  /** Seçili ID'ler, virgülle ayrılmış. */
  readonly value = input<string | number | undefined>(undefined);
  readonly placeholder = input('');
  readonly valueChange = output<string | undefined>();

  protected readonly open = signal(false);
  protected readonly panelPos = signal({ x: 0, y: 0 });
  protected readonly search = signal('');
  /** Panel açıkken düzenlenen taslak seçim. */
  protected readonly draft = signal<ReadonlySet<number>>(new Set());

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cdr.markForCheck());
  }

  /** Dışarıdan gelen değerin ID kümesi. */
  private readonly appliedIds = computed(() => this.parseIds(this.value()));

  private readonly sorted = computed(() =>
    [...this.classes()].sort((a, b) => compareClassNames(a.ad, b.ad)),
  );

  /** Aramaya uyan sınıflar seviyelere bölünmüş halde; "Diğer" grubu sonda. */
  protected readonly groups = computed<ClassGroupView[]>(() => {
    const term = this.search().trim().toLocaleLowerCase('tr');
    const byGrade = new Map<number | null, ClassItem[]>();
    for (const c of this.sorted()) {
      const grade = parseClassName(c.ad).grade;
      const matches =
        !term ||
        c.ad.toLocaleLowerCase('tr').includes(term) ||
        (grade !== null && String(grade) === term);
      if (!matches) continue;
      byGrade.set(grade, [...(byGrade.get(grade) ?? []), c]);
    }
    const numeric = [...byGrade.entries()]
      .filter(([g]) => g !== null)
      .sort(([a], [b]) => (a as number) - (b as number))
      .map(([grade, items]) => ({ grade, items }));
    const others = byGrade.get(null);
    return others ? [...numeric, { grade: null, items: others }] : numeric;
  });

  /** Tetikleyici butonda gösterilen özet: tam seçili seviyeler "5. Sınıf", diğerleri tek tek. */
  protected readonly summary = computed<string[]>(() => {
    const ids = this.appliedIds();
    if (ids.size === 0) return [];
    if (ids.size === this.classes().length && ids.size > 0) {
      return [this.translate.instant('SCHOOL_HOURS.ALL_CLASSES')];
    }
    const parts: string[] = [];
    const all = this.sorted();
    const grades = new Map<number | null, ClassItem[]>();
    for (const c of all) {
      const g = parseClassName(c.ad).grade;
      grades.set(g, [...(grades.get(g) ?? []), c]);
    }
    for (const [grade, items] of [...grades.entries()].sort(([a], [b]) =>
      a === null ? 1 : b === null ? -1 : a - b,
    )) {
      const selected = items.filter((c) => ids.has(c.id));
      if (!selected.length) continue;
      if (grade !== null && selected.length === items.length && items.length > 1) {
        parts.push(this.translate.instant('COMMON.GRADE_LABEL', { value: grade }));
      } else {
        parts.push(...selected.map((c) => c.ad));
      }
    }
    return parts;
  });

  // ---- panel ---------------------------------------------------------
  protected toggleOpen(event: MouseEvent): void {
    event.stopPropagation();
    if (this.open()) {
      this.close();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const width = 340;
    const height = 460;
    let x = rect.left;
    let y = rect.bottom + 4;
    if (x + width > window.innerWidth) x = Math.max(8, window.innerWidth - width - 8);
    if (y + height > window.innerHeight) y = Math.max(8, rect.top - height - 4);
    this.panelPos.set({ x, y });
    this.draft.set(new Set(this.appliedIds()));
    this.search.set('');
    this.open.set(true);
  }

  protected close(): void {
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (this.host.nativeElement.contains(event.target as Node)) return;
    this.close();
  }

  @HostListener('window:keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  @HostListener('window:resize')
  protected onResize(): void {
    this.close();
  }

  // ---- seçim ---------------------------------------------------------
  protected isSelected(id: number): boolean {
    return this.draft().has(id);
  }

  protected gradeAll(group: ClassGroupView): boolean {
    return group.items.length > 0 && group.items.every((c) => this.draft().has(c.id));
  }

  protected gradePartial(group: ClassGroupView): boolean {
    const n = group.items.filter((c) => this.draft().has(c.id)).length;
    return n > 0 && n < group.items.length;
  }

  protected toggleItem(item: ClassItem): void {
    const next = new Set(this.draft());
    if (!next.delete(item.id)) next.add(item.id);
    this.draft.set(next);
  }

  /** Seviye kutusu: tamamı seçiliyse seviyeyi temizler, değilse seviyenin tamamını seçer. */
  protected toggleGroup(group: ClassGroupView): void {
    const next = new Set(this.draft());
    const clear = this.gradeAll(group);
    for (const c of group.items) {
      if (clear) next.delete(c.id);
      else next.add(c.id);
    }
    this.draft.set(next);
  }

  protected selectAll(): void {
    this.draft.set(new Set(this.classes().map((c) => c.id)));
  }

  protected clearDraft(): void {
    this.draft.set(new Set());
  }

  protected apply(): void {
    const ids = this.sorted()
      .map((c) => c.id)
      .filter((id) => this.draft().has(id));
    this.close();
    const next = ids.length ? ids.join(',') : undefined;
    if (next !== this.normalize(this.value())) this.valueChange.emit(next);
  }

  private normalize(v: string | number | undefined): string | undefined {
    const ids = [...this.parseIds(v)];
    if (!ids.length) return undefined;
    const order = new Map(this.sorted().map((c, i) => [c.id, i]));
    return ids.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)).join(',');
  }

  private parseIds(v: string | number | undefined): ReadonlySet<number> {
    if (v === undefined || v === null || v === '') return new Set();
    return new Set(
      String(v)
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n)),
    );
  }
}
