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
  RowIssue,
} from '../../models/bulk-import.model';
import { BulkImportService } from '../../services/bulk-import.service';
import {
  ImportFileError,
  downloadImportTemplate,
  readImportWorkbook,
} from '../../utils/bulk-import-excel';
import { MAX_IMPORT_ROWS, validateImportRows } from '../../utils/bulk-import.utils';

type ImportStep = 'upload' | 'preview' | 'importing' | 'done';
type ImportPhase = 'records' | 'relations';
type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

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
  imports: [TranslatePipe, ButtonModule, ProgressBarModule, TableModule, TagModule],
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
  readonly onlyIssues = signal(false);
  readonly progress = signal({ done: 0, total: 0 });

  readonly isParent = computed(() => this.kind() === 'parent');
  readonly descriptionKey = computed(() =>
    this.isParent() ? 'BULK_IMPORT.DESCRIPTION_PARENT' : 'BULK_IMPORT.DESCRIPTION',
  );
  readonly keyColumnLabel = computed(() =>
    this.isParent() ? 'BULK_IMPORT.COL_TC' : 'BULK_IMPORT.COL_SCHOOL_NO',
  );
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
      exists: list.filter((r) => r.status === 'exists').length,
      error: list.filter((r) => r.status === 'error').length,
      /** Bu aktarımda kurulacak veli–öğrenci ilişkisi sayısı. */
      relations: active.reduce((sum, r) => sum + r.relationStudentIds.length, 0),
      /** Çalıştırılacak iş var mı (yeni kişi veya yeni ilişki)? */
      work: list.filter((r) => r.status === 'ready' || this.hasWork(r)).length,
      imported: list.filter((r) => r.outcome === 'imported').length,
      partial: list.filter((r) => r.outcome === 'partial').length,
      failed: list.filter((r) => r.outcome === 'failed').length,
    };
  });

  /** Raporda ve "sadece sorunlu" filtresinde gösterilen satırlar. */
  private isIssueRow(row: ImportRow): boolean {
    return (
      row.status === 'error' ||
      row.outcome === 'failed' ||
      row.outcome === 'partial' ||
      (row.status === 'exists' && !this.hasWork(row))
    );
  }

  /** Mevcut veli satırında kurulacak yeni ilişki var mı? */
  private hasWork(row: ImportRow): boolean {
    return row.status === 'exists' && row.relationStudentIds.length > 0;
  }

  readonly visibleRows = computed(() =>
    this.onlyIssues() ? this.rows().filter((r) => this.isIssueRow(r)) : this.rows(),
  );

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
      const context = await firstValueFrom(this.importService.loadValidationContext(kind));

      this.rows.set(validateImportRows(kind, parsed.rows, context));
      if (parsed.unknownHeaders.length > 0) {
        this.warnings.set([
          {
            key: 'BULK_IMPORT.WARN_UNKNOWN_COLUMNS',
            params: { columns: parsed.unknownHeaders.join(', ') },
          },
        ]);
      }
      this.fileName.set(file.name);
      this.onlyIssues.set(false);
      this.step.set('preview');
    } catch (error) {
      this.fileError.set(
        error instanceof ImportFileError ? error.issue : { key: 'BULK_IMPORT.ERR_ANALYZE_FAILED' },
      );
    } finally {
      this.busy.set(false);
    }
  }

  // ─── Aktarım ───

  startImport(): void {
    const toProcess = this.rows().filter((r) => r.status === 'ready' || this.hasWork(r));
    const toInsert = toProcess.filter((r) => r.status === 'ready');
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

        if (row.status === 'ready' && !run.recordOk) {
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

    this.step.set('done');
    this.importingChange.emit(false);

    const { imported, partial, failed } = this.counts();
    const problems = partial + failed;
    const relationsMade = Array.from(runs.values()).reduce((sum, r) => sum + r.relationsOk, 0);
    if (imported + partial > 0) this.imported.emit();

    const params = { count: imported + partial, imported, failed: problems, relations: relationsMade };
    const prefix = this.isParent() ? 'BULK_IMPORT.TOAST_PARENT' : 'BULK_IMPORT.TOAST';
    if (problems === 0) {
      this.notification.success(this.translate.instant(`${prefix}_DONE`, params));
    } else {
      this.notification.warning(this.translate.instant(`${prefix}_PARTIAL`, params));
    }
  }

  reset(): void {
    this.rows.set([]);
    this.fileName.set('');
    this.warnings.set([]);
    this.fileError.set(null);
    this.progress.set({ done: 0, total: 0 });
    this.step.set('upload');
  }

  // ─── Gösterim yardımcıları ───

  statusTag(row: ImportRow): { labelKey: string; severity: TagSeverity } {
    if (row.outcome === 'imported') return { labelKey: 'BULK_IMPORT.STATUS_IMPORTED', severity: 'success' };
    if (row.outcome === 'partial') return { labelKey: 'BULK_IMPORT.STATUS_PARTIAL', severity: 'warn' };
    if (row.outcome === 'failed') return { labelKey: 'BULK_IMPORT.STATUS_FAILED', severity: 'danger' };
    switch (row.status) {
      case 'ready':
        return { labelKey: 'BULK_IMPORT.STATUS_READY', severity: 'info' };
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
