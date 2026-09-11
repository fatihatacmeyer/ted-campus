import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { timer, Subscription, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SelectModule } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { LastPassService } from '../../services/last-pass.service';
import { LastPassRecord, TerminalGroup } from '../../models/last-pass.model';
import { TooltipModule } from 'primeng/tooltip';

// --- Kalıcı ayarlar (localStorage) ---
// Kullanıcının son seçtiği terminal grubu ve grid sayısı oturumlar arası
// korunur, böylece sayfa her açılışında aynı seçimler tekrarlanmaz.
const STORAGE_KEY_SELECTED_GROUP = 'lastPass.selectedGroupId';
const STORAGE_KEY_GRID_SIZE = 'lastPass.gridSize';

// import { ElementRef, ViewChild, effect } from '@angular/core';
// import { computeOptimalGrid } from '../../../../core/utils/grid-layout.util';

@Component({
  selector: 'app-last-pass',
  standalone: true,
  imports: [
    CommonModule,
    SelectModule,
    ProgressSpinnerModule,
    FormsModule,
    TranslatePipe,
    TooltipModule,
  ],
  templateUrl: './last-pass.html',
  styleUrl: './last-pass.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LastPassComponent implements OnInit {
  // @ViewChild('gridContainer') gridContainer!: ElementRef<HTMLElement>;
  // cardBox = signal<{ w: number; h: number }>({ w: 0, h: 0 });
  isFullScreen = signal<boolean>(false);

  private fullscreenListener = () => {
    this.isFullScreen.set(!!document.fullscreenElement);
  };

  private lastPassService = inject(LastPassService);
  private destroyRef = inject(DestroyRef);
  private resizeObserver?: ResizeObserver;

  // State Signals
  terminalGroups = signal<TerminalGroup[]>([]);
  selectedGroupId = signal<number | null>(null);
  recentPasses = signal<LastPassRecord[]>([]);
  isLoading = signal<boolean>(false);
  gridSize = signal<number>(
    Math.min(6, Math.max(1, LastPassComponent.readSavedNumber(STORAGE_KEY_GRID_SIZE, 4))),
  );

  readonly gridOptions: { label: string; value: number }[] = [1, 2, 3, 4, 5, 6].map((n) => ({
    label: String(n),
    value: n,
  }));

  private pollingSubscription?: Subscription;
  private readonly POLLING_INTERVAL_MS = 3000;

  // Kayıt sayısına karşılık gelen sabit grid yapıları (turnike-monitor mantığı):
  // 1 → 1 sütun, 2 → 2 sütun, 3 → 3 sütun, 4 → 2x2, 5 → 3+2, 6 → 3x2
  private static readonly GRID_CLASSES = [
    '',
    'grid-1',
    'grid-2',
    'grid-3',
    'grid-4',
    'grid-5',
    'grid-6',
  ];

  // Görünür kayıtlar: Eksik kalan alanları boş (idle) kartlarla doldurarak grid yapısını sabitler
  visibleRecords = computed<LastPassRecord[]>(() => {
    const records = this.recentPasses().slice(0, this.gridSize());
    const paddingCount = this.gridSize() - records.length;

    // Eğer gelen veri seçili grid boyutundan azsa, boş yerleri "Bekleniyor" kartı ile doldur
    if (paddingCount > 0) {
      const idleRecords = Array.from({ length: paddingCount }).map(
        () =>
          ({
            personId: 0,
            photoBase64: null,
            identityNo: '',
            fullName: '',
            department: '',
            company: '',
            position: '',
            passTime: '',
            terminalId: 0,
            terminalName: '',
            message: '',
            status: 0,
          }) as LastPassRecord,
      );

      return [...records, ...idleRecords];
    }

    return records;
  });

  // Grid sınıfını veri sayısına göre değil, DİREKT olarak kullanıcının seçtiği grid boyutuna göre ayarlar
  gridClass = computed<string>(() => {
    return LastPassComponent.GRID_CLASSES[this.gridSize()] ?? 'grid-1';
  });

  ngOnInit(): void {
    this.loadTerminalGroups();

    document.addEventListener('fullscreenchange', this.fullscreenListener);
  }

  // ngAfterViewInit(): void {
  //   this.resizeObserver = new ResizeObserver(() => this.recalculateGrid());
  //   this.resizeObserver.observe(this.gridContainer.nativeElement);
  //   this.recalculateGrid();
  // }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();

    document.removeEventListener('fullscreenchange', this.fullscreenListener);
  }

  toggleFullScreen(): void {
    // if (!document.fullscreenElement) {
    //   this.gridContainer.nativeElement.requestFullscreen().catch((err) => {
    //     console.error(`Tam ekrana geçiş hatası: ${err.message}`);
    //   });
    // } else {
    //   // Tam ekrandan çık
    //   document.exitFullscreen();
    // }

    if (!document.fullscreenElement) {
      // Doğrudan DOM elemanını class üzerinden seçerek tam ekrana gönder
      document
        .querySelector('.last-pass-grid')
        ?.requestFullscreen()
        .catch((err) => {
          console.error(`Tam ekrana geçiş hatası: ${err.message}`);
        });
    } else {
      document.exitFullscreen();
    }
  }

  // private recalculateGrid(): void {
  //   const el = this.gridContainer.nativeElement;
  //   const { cardWidth, cardHeight } = computeOptimalGrid(
  //     this.gridSize(),
  //     el.clientWidth,
  //     el.clientHeight,
  //   );
  //   this.cardBox.set({ w: cardWidth, h: cardHeight });
  // }

  // constructor() {
  //   effect(() => {
  //     this.gridSize(); // dependency
  //     queueMicrotask(() => this.recalculateGrid());
  //   });
  // }

  onGroupChange(groupId: number): void {
    this.selectedGroupId.set(groupId);
    LastPassComponent.writeSavedNumber(STORAGE_KEY_SELECTED_GROUP, groupId);
    this.startPolling();
  }

  private loadTerminalGroups(): void {
    this.isLoading.set(true);
    this.lastPassService
      .getTerminalGroups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (groups) => {
          this.terminalGroups.set(groups);
          if (groups.length > 0) {
            const savedGroupId = LastPassComponent.readSavedNumber(STORAGE_KEY_SELECTED_GROUP, -1);
            // Kayıtlı grup hâlâ listedeyse onu seç, silinmişse ilk gruba düş
            const groupId = groups.some((g) => g.id === savedGroupId) ? savedGroupId : groups[0].id;
            this.selectedGroupId.set(groupId);
            LastPassComponent.writeSavedNumber(STORAGE_KEY_SELECTED_GROUP, groupId);
            this.startPolling();
          }
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load terminal groups', err);
          this.isLoading.set(false);
        },
      });
  }

  private startPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }

    const source = this.pollByGroup();
    if (!source) return;

    this.pollingSubscription = timer(0, this.POLLING_INTERVAL_MS)
      .pipe(
        switchMap(() => source()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (records) => {
          this.recentPasses.set(records);
        },
        error: (err) => console.error('Polling error', err),
      });
  }

  private pollByGroup(): (() => Observable<LastPassRecord[]>) | null {
    const groupId = this.selectedGroupId();
    if (groupId === null) return null;
    return () => this.lastPassService.getRecentPassesByGroup(groupId);
  }

  private static readonly DEFAULT_AVATAR = 'assets/images/default-avatar.png';

  // Helper for UI — only emits a data URI for plausible base64 data,
  // otherwise falls back to the default avatar so no broken image flickers.
  getPhotoUrl(base64Data: string | null | undefined): string {
    if (this.isValidBase64Photo(base64Data)) {
      return `data:image/jpeg;base64,${base64Data!.trim()}`;
    }
    return LastPassComponent.DEFAULT_AVATAR;
  }

  // Fallback when an image still fails to load (e.g. corrupt base64).
  onPhotoError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = LastPassComponent.DEFAULT_AVATAR;
  }

  private isValidBase64Photo(value: string | null | undefined): boolean {
    const trimmed = (value ?? '').trim();
    // Must be non-trivial and consist only of base64 characters (allow padding '=').
    if (trimmed.length < 16) return false;
    return /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed);
  }

  // --- Kalıcı ayarlar (localStorage) ---
  // Kullanıcının son seçtiği terminal grubu ve grid sayısı saklanır;
  // geçersiz/erişilemez durumlarda fallback değer kullanılır ve hata sessizce yutulur.
  private static readSavedNumber(key: string, fallback: number): number {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const parsed = Number(raw);
      return Number.isInteger(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  private static writeSavedNumber(key: string, value: number): void {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Depolama erişilemezse (gizli mod, kota) sessizce yoksay
    }
  }

  trackByIndex(index: number, _record: LastPassRecord): number {
    return index;
  }

  onGridSizeChange(size: number): void {
    this.gridSize.set(size);
    LastPassComponent.writeSavedNumber(STORAGE_KEY_GRID_SIZE, size);
  }

  isIdleTerminal(record: LastPassRecord): boolean {
    return record.personId === 0;
  }
}
