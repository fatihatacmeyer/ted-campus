import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { timer, switchMap, filter } from 'rxjs';
import { SelectModule } from 'primeng/select';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { TooltipModule } from 'primeng/tooltip';

import { LastPassService } from '../../services/last-pass.service';
import { LastPassRecord, TerminalGroup } from '../../models/last-pass.model';
import { AppConfig, APP_CONFIG } from '../../../../core/services/app-config.service';
import { LastPassIconComponent } from './last-pass-icon';

// Kullanıcının son seçtiği terminal grubu ve grid sayısı oturumlar arası
// localStorage'da korunur; sayfa her açılışında aynı seçimler tekrarlanmaz.
const STORAGE_KEY_SELECTED_GROUP = 'lastPass.selectedGroupId';
const STORAGE_KEY_GRID_SIZE = 'lastPass.gridSize';
const POLLING_INTERVAL_MS = 3000;
const DEFAULT_AVATAR = 'assets/images/default-avatar.png';

// 1 → 1 sütun, 2 → 2 sütun, 3 → 3 sütun, 4 → 2x2, 5 → 3+2, 6 → 3x2
const GRID_CLASSES = ['', 'grid-1', 'grid-2', 'grid-3', 'grid-4', 'grid-5', 'grid-6'];

function createIdleRecord(): LastPassRecord {
  return {
    personId: 0,
    photoBase64: null,
    profilePhotoFileName: null,
    personType: null,
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
  } as LastPassRecord;
}

function readSavedNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    return Number.isInteger(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeSavedNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Depolama erişilemezse (gizli mod, kota) sessizce yoksay
  }
}

@Component({
  selector: 'app-last-pass',
  imports: [
    CommonModule,
    SelectModule,
    ProgressSpinnerModule,
    FormsModule,
    TranslatePipe,
    TooltipModule,
    LastPassIconComponent,
  ],
  templateUrl: './last-pass.html',
  styleUrl: './last-pass.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LastPassComponent implements OnInit {
  private readonly lastPassService = inject(LastPassService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly config: AppConfig = inject(APP_CONFIG);

  // --- State ---
  isFullScreen = signal(false);
  terminalGroups = signal<TerminalGroup[]>([]);
  selectedGroupId = signal<number | null>(null);
  recentPasses = signal<LastPassRecord[]>([]);
  isLoading = signal(false);
  gridSize = signal(Math.min(6, Math.max(1, readSavedNumber(STORAGE_KEY_GRID_SIZE, 4))));

  readonly gridOptions = [1, 2, 3, 4, 5, 6].map((n) => ({ label: String(n), value: n }));

  // Eksik kalan alanları boş (idle) kartlarla doldurarak grid yapısını sabitler
  visibleRecords = computed<LastPassRecord[]>(() => {
    const records = this.recentPasses().slice(0, this.gridSize());
    const paddingCount = this.gridSize() - records.length;
    return paddingCount > 0
      ? [...records, ...Array.from({ length: paddingCount }, createIdleRecord)]
      : records;
  });

  // Grid sınıfını veri sayısına göre değil, kullanıcının seçtiği grid boyutuna göre ayarlar
  gridClass = computed(() => GRID_CLASSES[this.gridSize()] ?? 'grid-1');

  private readonly fullscreenListener = () => {
    this.isFullScreen.set(!!document.fullscreenElement);
  };

  constructor() {
    // selectedGroupId değiştikçe (ilk yükleme dahil) 3 saniyede bir yoklama
    // (polling) başlatır/yeniler. Eski RxJS Subscription alanı yerine tek bir
    // reaktif zincir: toObservable + switchMap + takeUntilDestroyed.
    toObservable(this.selectedGroupId)
      .pipe(
        filter((groupId): groupId is number => groupId !== null),
        switchMap((groupId) =>
          timer(0, POLLING_INTERVAL_MS).pipe(
            switchMap(() => this.lastPassService.getRecentPassesByGroup(groupId)),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (records) => this.recentPasses.set(records),
        error: (err) => console.error('Polling error', err),
      });

    // document seviyesindeki listener bir @HostListener ile yakalanamaz;
    // temizliği DestroyRef.onDestroy ile yapıyoruz, ayrı bir ngOnDestroy'a gerek kalmıyor.
    document.addEventListener('fullscreenchange', this.fullscreenListener);
    this.destroyRef.onDestroy(() =>
      document.removeEventListener('fullscreenchange', this.fullscreenListener),
    );
  }

  ngOnInit(): void {
    this.loadTerminalGroups();
  }

  toggleFullScreen(): void {
    if (!document.fullscreenElement) {
      document
        .querySelector('.last-pass-grid')
        ?.requestFullscreen()
        .catch((err) => console.error(`Tam ekrana geçiş hatası: ${err.message}`));
    } else {
      document.exitFullscreen();
    }
  }

  onGroupChange(groupId: number): void {
    this.selectedGroupId.set(groupId);
    writeSavedNumber(STORAGE_KEY_SELECTED_GROUP, groupId);
  }

  onGridSizeChange(size: number): void {
    this.gridSize.set(size);
    writeSavedNumber(STORAGE_KEY_GRID_SIZE, size);
  }

  // Bir fotoğraf URL'i (dosya bazlı ya da data URI) döner,
  // fotoğraf yoksa template'in ikona düşmesi için null döner.
  getPhotoSource(record: LastPassRecord): string | null {
    const fileName = record.profilePhotoFileName?.trim();
    if (fileName) {
      const baseUrl = this.config.photoBaseUrl || 'http://localhost/MeCampus/ProfilFotograflari';
      return `${baseUrl}/${fileName}`;
    }
    if (this.isValidBase64Photo(record.photoBase64)) {
      return `data:image/jpeg;base64,${record.photoBase64!.trim()}`;
    }
    return null;
  }

  // Fotoğraf yüklenemediğinde (bozuk dosya, ağ hatası vb.) varsayılan avatara düşer.
  onPhotoError(event: Event): void {
    (event.target as HTMLImageElement).src = DEFAULT_AVATAR;
  }

  trackByIndex(index: number, _record: LastPassRecord): number {
    return index;
  }

  isIdleTerminal(record: LastPassRecord): boolean {
    return record.personId === 0 && !record.personType;
  }

  private isValidBase64Photo(value: string | null | undefined): boolean {
    const trimmed = (value ?? '').trim();
    // Anlamsız kısa değerleri ele; sadece base64 karakter setine (padding '=' dahil) izin ver.
    if (trimmed.length < 16) return false;
    return /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed);
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
            const savedGroupId = readSavedNumber(STORAGE_KEY_SELECTED_GROUP, -1);
            // Kayıtlı grup hâlâ listedeyse onu seç, silinmişse ilk gruba düş
            const groupId = groups.some((g) => g.id === savedGroupId) ? savedGroupId : groups[0].id;
            this.selectedGroupId.set(groupId);
            writeSavedNumber(STORAGE_KEY_SELECTED_GROUP, groupId);
          }
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load terminal groups', err);
          this.isLoading.set(false);
        },
      });
  }
}
