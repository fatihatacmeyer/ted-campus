import { Injectable, inject } from '@angular/core';
import { Observable, concat, defer, forkJoin, from, of } from 'rxjs';
import { catchError, map, mergeMap, switchMap, tap } from 'rxjs/operators';
import { Person, RelationCampusRow, UserDef } from '../../../core/models/person.model';
import {
  extractNewId,
  isSuccessResult,
  unwrapResponse,
} from '../../../shared/utils/response.utils';
import {
  ImportEvent,
  ImportKind,
  ImportLookups,
  ImportOutcome,
  ImportRow,
  LookupOption,
  ValidationContext,
} from '../models/bulk-import.model';
import { buildValidationContext, relationKey } from '../utils/bulk-import.utils';
import { DropdownItem, TypesService } from './types.service';
import { PersonService } from './person.service';

/** Aynı anda gönderilen en fazla kayıt/ilişki isteği. */
const IMPORT_CONCURRENCY = 3;

const GENDER_LABELS: Record<string, string> = { E: 'Erkek', K: 'Kadın' };

/** Dropdown kayıtlarını Excel'de yazılacak ada çevirir; "Seçiniz" gibi ID'si 0 olanlar atılır. */
function toOptions(items: DropdownItem[] | null | undefined): LookupOption[] {
  return (items ?? [])
    .map((item) => ({ id: Number(item.id), ad: String(item.ad ?? '').trim() }))
    .filter((option) => Number.isFinite(option.id) && option.id > 0 && option.ad !== '');
}

/** DB'de cinsiyet "E"/"K" tutulur; Excel'de "Erkek"/"Kadın" yazılır, ham değer takma ad olarak da kabul edilir. */
function toGenderOptions(items: DropdownItem[] | null | undefined): LookupOption[] {
  return toOptions(items).map((option) => {
    const label = GENDER_LABELS[option.ad];
    return label ? { id: option.id, ad: label, aliases: [option.ad] } : option;
  });
}

function relationKeysOf(rows: RelationCampusRow[]): Set<string> {
  const keys = new Set<string>();
  for (const row of rows ?? []) {
    const studentId = Number(row.OgrenciSicilId);
    const parentId = Number(row.VeliSicilId);
    if (Number.isFinite(studentId) && Number.isFinite(parentId)) {
      keys.add(relationKey(studentId, parentId));
    }
  }
  return keys;
}

interface RelationPair {
  rowNo: number;
  studentId: number;
  parentId: number;
}

/**
 * Toplu aktarımın veri katmanı: liste değerlerini ve mevcut kayıtları yükler, kişileri mevcut
 * PersonService.insertPerson ile (sınırlı eşzamanlılıkla) ekler. Veli aktarımında önce veliler
 * eklenir, ardından öğrenci ilişkileri kurulur ve oluştuğu okunarak doğrulanır.
 */
@Injectable({
  providedIn: 'root',
})
export class BulkImportService {
  private personService = inject(PersonService);
  private typesService = inject(TypesService);

  /** Şablondaki ve doğrulamadaki ad → ID çevrimi için liste değerlerini çeker. */
  loadLookups(): Observable<ImportLookups> {
    return forkJoin({
      firma: this.typesService.getDropdownList('cbo_firma').pipe(map(toOptions)),
      direktorluk: this.typesService.getDropdownList('cbo_direktorluk').pipe(map(toOptions)),
      bolum: this.typesService.getDropdownList('cbo_bolum').pipe(map(toOptions)),
      altfirma: this.typesService.getDropdownList('cbo_altfirma').pipe(map(toOptions)),
      cinsiyet: this.typesService.getGenderOptions().pipe(map(toGenderOptions)),
      kangrubu: this.typesService.getBloodTypes().pipe(map(toOptions)),
    });
  }

  /** Sistemdeki öğrenciler (veli şablonundaki "Öğrenci Listesi" sayfası için). */
  loadStudents(): Observable<Person[]> {
    return this.personService
      .getPersonListCampus()
      .pipe(map((persons) => persons.filter((p) => p.userdef === UserDef.Ogrenci)));
  }

  /** Önizleme doğrulamasının dayandığı mevcut verileri (kişiler, ilişkiler, listeler) çeker. */
  loadValidationContext(kind: ImportKind): Observable<ValidationContext> {
    return forkJoin({
      lookups: this.loadLookups(),
      persons: this.personService.getPersonListCampus(),
      relations: kind === 'parent' ? this.personService.getAllRelations() : of([]),
    }).pipe(
      map(({ lookups, persons, relations }) => buildValidationContext(lookups, persons, relations)),
    );
  }

  /**
   * 'ready' satırları kaydeder ve olayları yayımlar. Bir satırın hatası diğerlerini durdurmaz.
   * Veli aktarımında kayıtlar bittikten sonra ilişki aşaması çalışır.
   */
  importRows(kind: ImportKind, rows: ImportRow[]): Observable<ImportEvent> {
    // satır no → veli ID'si (mevcut veliler baştan, yeni eklenenler kayıt sonrası dolar)
    const parentIds = new Map<number, number>();
    const insertedOk = new Set<number>();
    for (const row of rows) {
      if (row.status === 'exists' && row.existingId !== null) parentIds.set(row.rowNo, row.existingId);
    }

    const insert$ = from(rows.filter((row) => row.status === 'ready' && row.payload)).pipe(
      mergeMap(
        (row) =>
          this.insertRow(row).pipe(
            tap((outcome) => {
              if (!outcome.ok) return;
              insertedOk.add(row.rowNo);
              if (outcome.id !== undefined) parentIds.set(row.rowNo, outcome.id);
            }),
            map((outcome): ImportEvent => ({ type: 'record', outcome })),
          ),
        IMPORT_CONCURRENCY,
      ),
    );

    if (kind === 'student') return insert$;
    return concat(
      insert$,
      defer(() => this.linkParents(rows, parentIds, insertedOk)),
    );
  }

  private insertRow(row: ImportRow): Observable<ImportOutcome> {
    return this.personService.insertPerson(row.payload!).pipe(
      map((response): ImportOutcome => {
        const result = unwrapResponse<Person>(response);
        const id = extractNewId(result);
        // Başarı: islemsonuc=1 ya da yeni kayıt ID'si dönmüş olması.
        const ok = isSuccessResult(result) || id !== null;
        if (!ok) console.warn('[BulkImport] satır kaydedilemedi:', row.rowNo, response);
        return {
          rowNo: row.rowNo,
          ok,
          id: id ?? undefined,
          message: ok ? undefined : (result?.sunucucevap ?? undefined),
        };
      }),
      catchError((error): Observable<ImportOutcome> => {
        console.error('[BulkImport] istek hatası:', row.rowNo, error);
        return of({ rowNo: row.rowNo, ok: false });
      }),
    );
  }

  /**
   * 2. aşama: veli–öğrenci ilişkilerini kurar. Mevcut çiftler tekrar eklenmez; sonunda
   * ilişkiler yeniden okunarak her çiftin gerçekten oluştuğu doğrulanır (addRelationCampus
   * yanıtı güvenilir başarı bilgisi taşımadığı için karar bu okumaya dayanır).
   */
  private linkParents(
    rows: ImportRow[],
    parentIds: Map<number, number>,
    insertedOk: Set<number>,
  ): Observable<ImportEvent> {
    const pairs: RelationPair[] = [];
    const unlinkable: ImportEvent[] = [];

    for (const row of rows) {
      if (row.status === 'error' || row.relationStudentIds.length === 0) continue;
      // Veli eklenemediyse ilişkileri denenmez; satır zaten "eklenemedi" olarak raporlanır.
      if (row.status === 'ready' && !insertedOk.has(row.rowNo)) continue;

      const parentId = parentIds.get(row.rowNo);
      for (const studentId of row.relationStudentIds) {
        if (parentId === undefined) {
          // Veli eklendi ama ID'si yanıttan okunamadı → ilişki kurulamaz.
          unlinkable.push({ type: 'relationResult', rowNo: row.rowNo, studentId, ok: false });
        } else {
          pairs.push({ rowNo: row.rowNo, studentId, parentId });
        }
      }
    }

    if (pairs.length === 0) return from(unlinkable);

    return this.personService.getAllRelations().pipe(
      catchError(() => of([] as RelationCampusRow[])),
      switchMap((existing) => {
        const known = relationKeysOf(existing);
        const todo = pairs.filter((p) => !known.has(relationKey(p.studentId, p.parentId)));

        const attempts$ = from(todo).pipe(
          mergeMap(
            (pair) =>
              this.personService.addRelationCampus(pair.studentId, pair.parentId).pipe(
                catchError((error) => {
                  console.error('[BulkImport] ilişki eklenemedi:', pair, error);
                  return of(null);
                }),
                map((): ImportEvent => ({ type: 'relationAttempt' })),
              ),
            IMPORT_CONCURRENCY,
          ),
        );

        const verify$ = defer(() => this.personService.getAllRelations()).pipe(
          map((rels) => relationKeysOf(rels)),
          catchError(() => of(new Set<string>())),
          mergeMap((found) =>
            from([
              ...pairs.map(
                (p): ImportEvent => ({
                  type: 'relationResult',
                  rowNo: p.rowNo,
                  studentId: p.studentId,
                  ok: found.has(relationKey(p.studentId, p.parentId)),
                }),
              ),
              ...unlinkable,
            ]),
          ),
        );

        return concat(of<ImportEvent>({ type: 'relationsStart', total: todo.length }), attempts$, verify$);
      }),
    );
  }
}
