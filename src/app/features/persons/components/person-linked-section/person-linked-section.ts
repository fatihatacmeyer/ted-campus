import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlContainer, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { concat, Observable, of } from 'rxjs';

import { Person, RelationCampusRow, UserDef } from '../../../../core/models/person.model';
import { PersonService } from '../../services/person.service';
import { linkedKindKey, linkedTargetUserdef } from '../../utils/linked-person.utils';

interface ExistingRelation {
  relid: number;
  linkedId: number;
  linkedName: string;
  sicilno: string;
}

interface RelationChange {
  relid: number;
  newLinkedId: number;
}

interface RelationDisplayRow extends ExistingRelation {
  changed?: boolean;
  pending?: boolean;
}

@Component({
  selector: 'app-person-linked-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TooltipModule,
  ],
  viewProviders: [
    {
      provide: ControlContainer,
      useFactory: () => inject(ControlContainer, { skipSelf: true }),
    },
  ],
  templateUrl: './person-linked-section.html',
  styleUrl: './person-linked-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonLinkedSectionComponent implements OnChanges {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) userdef!: number;
  @Input() allPersons: Person[] = [];
  @Input() isEditMode = false;
  @Input() personId: number | null = null;

  private personService = inject(PersonService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  isCreatingNewLinked = false;

  existingRelations: ExistingRelation[] = [];
  removedRelIds: number[] = [];
  changedRelations: RelationChange[] = [];
  pendingAdditions: number[] = [];
  changingRelid: number | null = null;
  confirmRemoveKey: string | null = null;

  private cachedLinkedOptions: { label: string; value: number }[] | null = null;

  private invalidateLinkedOptions(): void {
    this.cachedLinkedOptions = null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['allPersons'] || changes['userdef']) {
      this.invalidateLinkedOptions();
    }
    if (changes['personId']) {
      this.resetRelationState();
      if (this.personId) this.loadExistingRelations(this.personId);
    }
  }

  get linkedKind(): string {
    return linkedKindKey(this.userdef);
  }

  get linkedSectionTitle(): string {
    return this.userdef === UserDef.Veli ? 'PERSON.CHILD_INFO' : 'PERSON.PARENT_INFO';
  }

  get newLinkedToggleLabel(): string {
    return this.isCreatingNewLinked ? 'PERSON.SELECT_FROM_LIST' : 'PERSON.CREATE_NEW_LINKED';
  }

  readonly linkedSelectPlaceholder = 'PERSON.SELECT_LINKED';

  readonly changeLinkedPlaceholder = 'PERSON.SELECT_NEW_LINKED';

  readonly addLinkedButtonLabel = 'PERSON.ADD_LINKED';

  get changeLinkedTooltip(): string {
    return this.userdef === UserDef.Veli ? 'PERSON.CHANGE_STUDENT' : 'PERSON.CHANGE_PARENT';
  }

  get removeLinkedTooltip(): string {
    return this.userdef === UserDef.Veli
      ? 'PERSON.REMOVE_STUDENT_RELATION'
      : 'PERSON.REMOVE_PARENT_RELATION';
  }

  get noLinkedText(): string {
    return this.userdef === UserDef.Veli ? 'PERSON.NO_STUDENT' : 'PERSON.NO_PARENT';
  }

  readonly linkedFilterPlaceholder = 'PERSON.SEARCH_LINKED';

  get linkedPersonOptions(): { label: string; value: number }[] {
    if (this.cachedLinkedOptions) return this.cachedLinkedOptions;

    const targetUserdef = linkedTargetUserdef(this.userdef);

    const excludedIds = new Set<number>();
    for (const rel of this.existingRelations) {
      if (!this.removedRelIds.includes(rel.relid)) excludedIds.add(rel.linkedId);
    }
    for (const linkedId of this.pendingAdditions) excludedIds.add(linkedId);

    this.cachedLinkedOptions = this.allPersons
      .filter((p) => p.userdef === targetUserdef && !excludedIds.has(p.id))
      .map((p) => ({ label: `${p.adsoyad} (${p.sicilno ? p.sicilno : p.id})`, value: p.id }));
    return this.cachedLinkedOptions;
  }

  toggleNewLinkedMode(): void {
    this.isCreatingNewLinked = !this.isCreatingNewLinked;

    if (this.isCreatingNewLinked) {
      this.form.get('linkedPersonId')?.setValue(null);
    } else {
      this.form.patchValue({ yeniLinkedAd: '', yeniLinkedSoyad: '', yeniLinkedTelefon: '' });
    }
  }

  stopCreatingNew(): void {
    this.isCreatingNewLinked = false;
    this.cdr.markForCheck();
  }

  private loadExistingRelations(personId: number): void {
    const ogrenciModu = this.userdef === UserDef.Ogrenci;
    const obs = ogrenciModu
      ? this.personService.getStudentRelation(personId)
      : this.personService.getParentRelations(personId);

    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows: RelationCampusRow[]) => {
        this.existingRelations = (rows || []).map((r) => {
          const linkedId = Number(ogrenciModu ? r.VeliSicilId : r.OgrenciSicilId);
          const relid = Number(r.relid ?? r.Id);
          const linked = this.allPersons.find((p) => p.id === linkedId);
          return {
            relid,
            linkedId,
            linkedName: linked ? linked.adsoyad : `${this.linkedKind} #${linkedId}`,
            sicilno: linked?.sicilno ?? '',
          };
        });
        this.invalidateLinkedOptions();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('[PersonForm] Mevcut ilişkiler yüklenemedi:', err);
        this.existingRelations = [];
        this.invalidateLinkedOptions();
        this.cdr.markForCheck();
      },
    });
  }

  resetRelationState(): void {
    this.existingRelations = [];
    this.removedRelIds = [];
    this.changedRelations = [];
    this.pendingAdditions = [];
    this.changingRelid = null;
    this.confirmRemoveKey = null;
    this.isCreatingNewLinked = false;
    this.invalidateLinkedOptions();
    this.cdr.markForCheck();
  }

  get relationRows(): RelationDisplayRow[] {
    const rows: RelationDisplayRow[] = [];

    for (const rel of this.existingRelations) {
      if (this.removedRelIds.includes(rel.relid)) continue;

      const change = this.changedRelations.find((c) => c.relid === rel.relid);
      const linkedId = change ? change.newLinkedId : rel.linkedId;
      const linked = this.allPersons.find((p) => p.id === linkedId);

      rows.push({
        relid: rel.relid,
        linkedId,
        linkedName: linked ? linked.adsoyad : `${this.linkedKind} #${linkedId}`,
        sicilno: linked?.sicilno ?? '',
        changed: !!change,
      });
    }

    for (const linkedId of this.pendingAdditions) {
      const linked = this.allPersons.find((p) => p.id === linkedId);
      rows.push({
        relid: 0,
        linkedId,
        linkedName: linked ? linked.adsoyad : `${this.linkedKind} #${linkedId}`,
        sicilno: linked?.sicilno ?? '',
        pending: true,
      });
    }

    return rows;
  }

  rowKey(row: RelationDisplayRow): string {
    return row.relid ? `rel-${row.relid}` : `add-${row.linkedId}`;
  }

  addSelectedLinked(): void {
    const linkedId = this.form.value.linkedPersonId ? Number(this.form.value.linkedPersonId) : null;
    if (!linkedId) return;
    this.addPendingLinked(linkedId);
    this.form.patchValue({ linkedPersonId: null });
    this.cdr.markForCheck();
  }

  addPendingLinked(linkedId: number): void {
    if (this.pendingAdditions.includes(linkedId)) return;
    this.pendingAdditions.push(linkedId);
    this.invalidateLinkedOptions();
    this.cdr.markForCheck();
  }

  startChange(row: RelationDisplayRow): void {
    if (!row.relid) return;
    this.changingRelid = row.relid;
    this.form.patchValue({ changeLinkedId: null });
    this.cdr.markForCheck();
  }

  cancelChange(): void {
    this.changingRelid = null;
    this.form.patchValue({ changeLinkedId: null });
    this.cdr.markForCheck();
  }

  confirmChange(): void {
    const linkedId = this.form.value.changeLinkedId ? Number(this.form.value.changeLinkedId) : null;
    if (!linkedId || !this.changingRelid) return;

    const relid = this.changingRelid;
    const idx = this.changedRelations.findIndex((c) => c.relid === relid);
    if (idx >= 0) {
      this.changedRelations[idx] = { relid, newLinkedId: linkedId };
    } else {
      this.changedRelations.push({ relid, newLinkedId: linkedId });
    }
    this.removedRelIds = this.removedRelIds.filter((id) => id !== relid);
    this.invalidateLinkedOptions();

    this.changingRelid = null;
    this.form.patchValue({ changeLinkedId: null });
    this.cdr.markForCheck();
  }

  requestRemove(row: RelationDisplayRow): void {
    this.confirmRemoveKey = this.rowKey(row);
    this.cdr.markForCheck();
  }

  cancelRemove(): void {
    this.confirmRemoveKey = null;
    this.cdr.markForCheck();
  }

  confirmRemove(row: RelationDisplayRow): void {
    this.confirmRemoveKey = null;
    this.removeRelation(row);
  }

  removeRelation(row: RelationDisplayRow): void {
    if (row.relid) {
      this.removedRelIds.push(row.relid);
      this.changedRelations = this.changedRelations.filter((c) => c.relid !== row.relid);
    } else {
      this.pendingAdditions = this.pendingAdditions.filter((id) => id !== row.linkedId);
    }
    if (this.changingRelid === row.relid) this.changingRelid = null;
    this.invalidateLinkedOptions();
    this.cdr.markForCheck();
  }

  applyRelationOps(personId: number): Observable<unknown> {
    const ops: Observable<unknown>[] = [];
    const ogrenciModu = this.userdef === UserDef.Ogrenci;

    for (const relid of this.removedRelIds) {
      ops.push(this.personService.deleteRelationCampus(relid));
    }
    for (const change of this.changedRelations) {
      ops.push(
        ogrenciModu
          ? this.personService.updateRelationCampus(personId, change.newLinkedId, change.relid)
          : this.personService.updateRelationCampus(change.newLinkedId, personId, change.relid),
      );
    }
    for (const linkedId of this.pendingAdditions) {
      ops.push(
        ogrenciModu
          ? this.personService.addRelationCampus(personId, linkedId)
          : this.personService.addRelationCampus(linkedId, personId),
      );
    }

    return ops.length ? concat(...ops) : of(null);
  }
}
