import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { NotificationService } from '../../../../core/services/notification.service';
import { exportToExcel } from '../../../../shared/utils/table-export.utils';
import {
  ImportEvent,
  ImportKind,
  ImportRow,
  ImportOutcomeStatus,
  RawImportRow,
  RowIssue,
  ValidationContext,
} from '../../models/bulk-import.model';
import { BulkImportService } from '../../services/bulk-import.service';
import {
  ImportFileError,
  downloadFixFile,
  downloadImportTemplate,
  readImportWorkbook,
} from '../../utils/bulk-import-excel';
import { MAX_IMPORT_ROWS, validateImportRows } from '../../utils/bulk-import.utils';
import {
  ReasonGroup,
  ReasonKind,
  RowFilter,
  groupReasons,
  matchesRowFilter,
  matchesSearch,
  reasonIdsOf,
} from '../../utils/bulk-import-summary.utils';

type ImportStep = 'upload' | 'preview' | 'importing' | 'done';
type ImportPhase = 'records' | 'relations';
type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

/** Çözüm ipucu gösterilen sorun türleri (i18n: BULK_IMPORT.REASON_HINT.<anahtar>). */
const HINTED_REASONS = new Set([
  'ISSUE_EXISTS',
  'ISSUE_EXISTS_MULTIPLE',
  'ISSUE_EXISTS_NO_CHANGES',
  'ISSUE_LOOKUP_NOT_FOUND',
  'ISSUE_DUPLICATE_IN_FILE',
  'ISSUE_DUPLICATE_TC_IN_FILE',
  'ISSUE_STUDENT_NOT_FOUND',
  'ISSUE_INVALID_STUDENT_ID',
  'ERR_SERVER',
]);

/** Neden paneli satırı: grup + gösterim anahtarları. */
interface ReasonItem extends ReasonGroup {
  labelKey: string;
  hintKey: string | null;
}

interface ReasonSection {
  kind: ReasonKind;
  titleKey: string;
  items: ReasonItem[];
}

/** Aktarım sırasında satır başına biriken sonuçlar; bitişte satıra yazılır. */
interface RowRun {
  recordOk?: boolean;
  recordMessage?: string;
  relationsOk: number;
  relationsFailed: number;
}

/** Toplu aktarım akışı (şablon → yükle → önizle → aktar). Diyalog içinde kullanılır. */
@Component({
  selector: 'app-bulk-import',
  standalone: true,
  imports: [TranslatePipe, ButtonModule, InputTextModule, ProgressBarModule, TableModule, TagModule],
  templateUrl: './bulk-import.html',
  styleUrl: './bulk-import.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkImportComponent {
  private importService = inject(BulkImportService);
  private notification = inject(NotificationService);
  private translate = inject(TranslateService);

  /** Aktarılacak kişi türü: öğrenci veya veli. */
  readonly kind = input.required<ImportKind>();

  /** En az bir kayıt/ilişki eklendiğinde yayımlanır; üst sayfa listeyi yeniler. */
  readonly imported = output<void>();
  /** Aktarım sürerken true; üst diyalog bu sırada kapatılamaz. */
  readonly importingChange = output<boolean>();

  readonly maxRows = MAX_IMPORT_ROWS;

  readonly step = signal<ImportStep>('upload');
  readonly phase = signal<ImportPhase>('records');
  readonly busy = signal(false);
  readonly fileName = signal('');
  readonly rows = signal<ImportRow[]>([]);
  readonly fileError = signal<RowIssue | null>(null);
  readonly warnings = signal<RowIssue[]>([]);
  /** Özet kutucuğuyla seçilen durum filtresi. */
  readonly statusFilter = signal<RowFilter>('all');
  /** Neden panelinden seçilen sorun grubu (ReasonGroup.id). */
  readonly reasonFilter = signal<string | null>(null);
  readonly search = signal('');
  /** Öğrenci: TC'si sistemde tek kayıtla eşleşen satırlar atlanmak yerine güncellenir. */
  readonly updateExisting = signal(false);

  /** Önizleme, onay kutusu değiştiğinde yeniden doğrulanabilsin diye saklanır. */
  private rawRows: RawImportRow[] = [];
  private context: ValidationContext | null = null;
  readonly progress = signal({ done: 0, total: 0 });

  readonly isParent = computed(() => this.kind() === 'parent');
  readonly descriptionKey = computed(() =>
    this.isParent() ? 'BULK_IMPORT.DESCRIPTION_PARENT' : 'BULK_IMPORT.DESCRIPTION',
  );
  readonly keyColumnLabel = computed(() => 'BULK_IMPORT.COL_TC');
  readonly startLabelKey = computed(() =>
    this.isParent() ? 'BULK_IMPORT.START_IMPORT_PARENT' : 'BULK_IMPORT.START_IMPORT',
  );

  readonly counts = computed(() => {
    const list = this.rows();
    const active = list.filter((r) => r.status !== 'error');
    return {
      total: list.length,
      /** Eklenecek yeni kişi sayısı. */
      ready: list.filter((r) => r.status === 'ready').length,
      /** Güncellenecek mevcut öğrenci sayısı. */
      update: list.filter((r) => r.status === 'update').length,
      exists: list.filter((r) => r.status === 'exists').length,
      error: list.filter((r) => r.status === 'error').length,
      /** Bu aktarımda kurulacak veli–öğrenci ilişkisi sayısı. */
      relations: active.reduce((sum, r) => sum + r.relationStudentIds.length, 0),
      /** Çalıştırılacak iş var mı (yeni kişi veya yeni ilişki)? */
      work: list.filter((r) => this.needsRecord(r) || this.hasWork(r)).length,
      imported: list.filter((r) => r.outcome === 'imported' && r.status !== 'update').length,
      updated: list.filter((r) => r.outcome === 'imported' && r.status === 'update').length,
      partial: list.filter((r) => r.outcome === 'partial').length,
      failed: list.filter((r) => r.outcome === 'failed').length,
      /** Düzeltilip yeniden yüklenebilecek satır sayısı. */
      fixable: list.filter((r) => this.isFixRow(r)).length,
    };
  });

  /** Excel raporunda yer alan satırlar. */
  private isIssueRow(row: ImportRow): boolean {
    return (
      row.status === 'error' ||
      row.outcome === 'failed' ||
      row.outcome === 'partial' ||
      (row.status === 'exists' && !this.hasWork(row))
    );
  }

  /** Düzeltilip yeniden yüklenmesi gereken satır mı (hatalı ya da aktarılamamış)? */
  private isFixRow(row: ImportRow): boolean {
    return row.status === 'error' || row.outcome === 'failed' || row.outcome === 'partial';
  }

  /** Kayıt isteği atılacak satır mı (yeni ekleme veya güncelleme)? */
  private needsRecord(row: ImportRow): boolean {
    return row.status === 'ready' || row.status === 'update';
  }

  /** Mevcut veli satırında kurulacak yeni ilişki var mı? */
  private hasWork(row: ImportRow): boolean {
    return row.status === 'exists' && row.relationStudentIds.length > 0;
  }

  readonly visibleRows = computed(() => {
    const filter = this.statusFilter();
    const reason = this.reasonFilter();
    const term = this.search();
    return this.rows().filter(
      (r) =>
        matchesRowFilter(r, filter) &&
        (reason === null || reasonIdsOf(r).includes(reason)) &&
        matchesSearch(r, term),
    );
  });

  readonly hasFilter = computed(
    () => this.statusFilter() !== 'all' || this.reasonFilter() !== null || this.search().trim() !== '',
  );

  /** Hatalı / atlanan / aktarılamayan satırların sorun türüne göre dökümü. */
  readonly reasonSections = computed((): ReasonSection[] => {
    const groups = groupReasons(this.rows());
    const titles: Record<ReasonKind, string> = {
      error: 'BULK_IMPORT.REASONS_ERROR',
      skipped: 'BULK_IMPORT.REASONS_SKIPPED',
      failed: 'BULK_IMPORT.REASONS_FAILED',
    };
    return (Object.keys(titles) as ReasonKind[])
      .map((kind) => ({
        kind,
        titleKey: titles[kind],
        items: groups.filter((g) => g.kind === kind).map((g) => this.toReasonItem(g)),
      }))
      .filter((section) => section.items.length > 0);
  });

  private toReasonItem(group: ReasonGroup): ReasonItem {
    const name = group.issueKey.replace(/^BULK_IMPORT\./, '');
    // "Güncellemek için kutuyu işaretleyin" ipucu yalnızca kutu kapalıyken anlamlı.
    const hinted = HINTED_REASONS.has(name) && !(name === 'ISSUE_EXISTS' && this.updateExisting());
    return {
      ...group,
      labelKey: `BULK_IMPORT.REASON.${name}`,
      hintKey: hinted ? `BULK_IMPORT.REASON_HINT.${name}` : null,
    };
  }

  /** Kutucuğa tıklama: aynı kutuya tekrar tıklanınca filtre kalkar. */
  setStatusFilter(filter: RowFilter): void {
    this.statusFilter.set(this.statusFilter() === filter ? 'all' : filter);
    this.reasonFilter.set(null);
  }

  setReasonFilter(id: string): void {
    this.reasonFilter.set(this.reasonFilter() === id ? null : id);
    this.statusFilter.set('all');
  }

  clearFilters(): void {
    this.statusFilter.set('all');
    this.reasonFilter.set(null);
    this.search.set('');
  }

  readonly percent = computed(() => {
    const { done, total } = this.progress();
    return total === 0 ? 0 : Math.round((done / total) * 100);
  });

  // ─── Şablon ───

  async downloadTemplate(): Promise<void> {
    this.busy.set(true);
    this.fileError.set(null);
    try {
      const kind = this.kind();
      const [lookups, students] = await Promise.all([
        firstValueFrom(this.importService.loadLookups()),
        // Veli şablonundaki "Öğrenci Listesi" sayfası için.
        kind === 'parent' ? firstValueFrom(this.importService.loadStudents()) : Promise.resolve([]),
      ]);
      downloadImportTemplate(kind, lookups, students);
    } catch {
      this.fileError.set({ key: 'BULK_IMPORT.ERR_LOOKUPS_LOAD' });
    } finally {
      this.busy.set(false);
    }
  }

  // ─── Dosya yükleme ve doğrulama ───

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Aynı dosya tekrar seçilebilsin diye sıfırlanır.
    input.value = '';
    if (!file) return;

    this.busy.set(true);
    this.fileError.set(null);
    this.warnings.set([]);
    try {
      const kind = this.kind();
      const parsed = await readImportWorkbook(file, kind);
      this.context = await firstValueFrom(this.importService.loadValidationContext(kind));
      this.rawRows = parsed.rows;
      // Onay kutusu kullanıcının tercihi: dosya yeniden yüklense de korunur.
      this.revalidate();
      if (parsed.unknownHeaders.length > 0) {
        this.warnings.set([
          {
            key: 'BULK_IMPORT.WARN_UNKNOWN_COLUMNS',
            params: { columns: parsed.unknownHeaders.join(', ') },
          },
        ]);
      }
      this.fileName.set(file.name);
      this.clearFilters();
      this.step.set('preview');
    } catch (error) {
      this.fileError.set(
        error instanceof ImportFileError ? error.issue : { key: 'BULK_IMPORT.ERR_ANALYZE_FAILED' },
      );
    } finally {
      this.busy.set(false);
    }
  }

  /** Ham satırları güncel seçeneklerle yeniden doğrular (dosya ve sistem verisi yeniden okunmaz). */
  private revalidate(): void {
    if (!this.context) return;
    this.rows.set(
      validateImportRows(this.kind(), this.rawRows, this.context, {
        updateExisting: this.updateExisting(),
      }),
    );
  }

  onUpdateExistingChange(checked: boolean): void {
    this.updateExisting.set(checked);
    this.revalidate();
  }

  // ─── Aktarım ───

  startImport(): void {
    const toProcess = this.rows().filter((r) => this.needsRecord(r) || this.hasWork(r));
    const toInsert = toProcess.filter((r) => this.needsRecord(r));
    if (toProcess.length === 0) return;

    const runs = new Map<number, RowRun>();
    const runOf = (rowNo: number): RowRun => {
      let run = runs.get(rowNo);
      if (!run) {
        run = { relationsOk: 0, relationsFailed: 0 };
        runs.set(rowNo, run);
      }
      return run;
    };

    this.phase.set('records');
    this.progress.set({ done: 0, total: toInsert.length });
    this.step.set('importing');
    this.importingChange.emit(true);

    this.importService.importRows(this.kind(), toProcess).subscribe({
      next: (event: ImportEvent) => {
        switch (event.type) {
          case 'record': {
            const run = runOf(event.outcome.rowNo);
            run.recordOk = event.outcome.ok;
            run.recordMessage = event.outcome.message;
            this.progress.update((p) => ({ ...p, done: p.done + 1 }));
            break;
          }
          case 'relationsStart':
            this.phase.set('relations');
            this.progress.set({ done: 0, total: event.total });
            break;
          case 'relationAttempt':
            this.progress.update((p) => ({ ...p, done: p.done + 1 }));
            break;
          case 'relationResult': {
            const run = runOf(event.rowNo);
            if (event.ok) run.relationsOk++;
            else run.relationsFailed++;
            break;
          }
        }
      },
      complete: () => this.finish(runs),
    });
  }

  /** Biriken sonuçları satırlara yazar, özeti gösterir. */
  private finish(runs: Map<number, RowRun>): void {
    this.rows.update((list) =>
      list.map((row) => {
        const run = runs.get(row.rowNo);
        if (!run) return row;

        let outcome: ImportOutcomeStatus;
        let outcomeIssue: RowIssue | undefined;

        if (this.needsRecord(row) && !run.recordOk) {
          outcome = 'failed';
          outcomeIssue = run.recordMessage
            ? { key: 'BULK_IMPORT.ERR_SERVER', params: { message: run.recordMessage } }
            : { key: 'BULK_IMPORT.ERR_SAVE_FAILED' };
        } else if (run.relationsFailed > 0) {
          const total = run.relationsOk + run.relationsFailed;
          // Yeni veli eklendiyse kısmi, mevcut velide hiç ilişki kurulamadıysa başarısız.
          outcome = row.status === 'ready' || run.relationsOk > 0 ? 'partial' : 'failed';
          outcomeIssue = {
            key: 'BULK_IMPORT.ERR_RELATIONS_FAILED',
            params: { failed: run.relationsFailed, total },
          };
        } else {
          outcome = 'imported';
        }
        return { ...row, outcome, outcomeIssue };
      }),
    );

    this.clearFilters();
    this.step.set('done');
    this.importingChange.emit(false);

    const { imported, updated, partial, failed } = this.counts();
    const problems = partial + failed;
    const relationsMade = Array.from(runs.values()).reduce((sum, r) => sum + r.relationsOk, 0);
    if (imported + partial > 0) this.imported.emit();

    const params = {
      count: imported + partial,
      imported,
      updated,
      failed: problems,
      relations: relationsMade,
    };
    // Güncelleme içeren öğrenci aktarımı "eklendi / güncellendi" ayrımını gösterir.
    const prefix = this.isParent() ? 'BULK_IMPORT.TOAST_PARENT' : 'BULK_IMPORT.TOAST';
    const suffix = !this.isParent() && updated > 0 ? '_UPDATE' : '';
    if (problems === 0) {
      this.notification.success(this.translate.instant(`${prefix}_DONE${suffix}`, params));
    } else {
      this.notification.warning(this.translate.instant(`${prefix}_PARTIAL${suffix}`, params));
    }
  }

  reset(): void {
    this.rows.set([]);
    this.rawRows = [];
    this.context = null;
    this.fileName.set('');
    this.warnings.set([]);
    this.fileError.set(null);
    this.progress.set({ done: 0, total: 0 });
    this.step.set('upload');
  }

  // ─── Gösterim yardımcıları ───

  statusTag(row: ImportRow): { labelKey: string; severity: TagSeverity } {
    if (row.outcome === 'imported') {
      return {
        labelKey: row.status === 'update' ? 'BULK_IMPORT.STATUS_UPDATED' : 'BULK_IMPORT.STATUS_IMPORTED',
        severity: 'success',
      };
    }
    if (row.outcome === 'partial') return { labelKey: 'BULK_IMPORT.STATUS_PARTIAL', severity: 'warn' };
    if (row.outcome === 'failed') return { labelKey: 'BULK_IMPORT.STATUS_FAILED', severity: 'danger' };
    switch (row.status) {
      case 'ready':
        return { labelKey: 'BULK_IMPORT.STATUS_READY', severity: 'info' };
      case 'update':
        return { labelKey: 'BULK_IMPORT.STATUS_UPDATE', severity: 'info' };
      case 'exists':
        return this.hasWork(row)
          ? { labelKey: 'BULK_IMPORT.STATUS_EXISTS_LINK', severity: 'info' }
          : { labelKey: 'BULK_IMPORT.STATUS_EXISTS', severity: 'warn' };
      default:
        return { labelKey: 'BULK_IMPORT.STATUS_ERROR', severity: 'danger' };
    }
  }

  rowIssues(row: ImportRow): RowIssue[] {
    return row.outcomeIssue ? [row.outcomeIssue] : row.issues;
  }

  /** Hatalı ve aktarılamayan satırları, düzeltilip yeniden yüklenebilecek şablon olarak indirir. */
  downloadFixRows(): void {
    const rawByRow = new Map(this.rawRows.map((raw) => [raw.rowNo, raw]));
    const items = this.rows()
      .filter((r) => this.isFixRow(r) && rawByRow.has(r.rowNo))
      .map((r) => ({
        raw: rawByRow.get(r.rowNo)!,
        error: this.rowIssues(r)
          .map((issue) => this.translate.instant(issue.key, issue.params) as string)
          .join('; '),
      }));
    if (items.length === 0) return;
    downloadFixFile(this.kind(), items, this.context?.lookups ?? null);
  }

  /** Atlanan, hatalı ve kaydedilemeyen satırları Excel olarak indirir. */
  downloadReport(): void {
    const t = (key: string, params?: Record<string, string | number>) =>
      this.translate.instant(key, params) as string;

    const headers = [
      t('BULK_IMPORT.COL_ROW'),
      t('BULK_IMPORT.COL_NAME'),
      t(this.keyColumnLabel()),
      t('BULK_IMPORT.COL_STATUS'),
      t('BULK_IMPORT.COL_DETAIL'),
    ];
    const reportRows = this.rows()
      .filter((r) => this.isIssueRow(r))
      .map((r) => [
        r.rowNo,
        `${r.ad} ${r.soyad}`.trim(),
        r.key,
        t(this.statusTag(r).labelKey),
        this.rowIssues(r)
          .map((issue) => t(issue.key, issue.params))
          .join('; '),
      ]);
    exportToExcel(this.isParent() ? 'veli-aktarim-rapor' : 'ogrenci-aktarim-rapor', headers, reportRows);
  }
}
