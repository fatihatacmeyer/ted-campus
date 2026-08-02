import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { PersonService } from '../../services/person.service';
import { unwrapResponse } from '../../../../shared/utils/response.utils';
import {
  Person,
  UserDef,
  getUserDefLabel,
  extractLinkedPersonIds,
  extractLinkedTeacherIds,
} from '../../../../core/models/person.model';
import { PersonTableComponent } from '../../../../shared/components/person-table/person-table';
import { PersonFormComponent } from '../../components/person-form/person-form';
import { PersonExitDialogComponent } from '../../components/person-exit-dialog/person-exit-dialog';
import { PersonLeaveDialogComponent } from '../../components/person-leave-dialog/person-leave-dialog';
import { PersonProfileComponent } from '../../components/person-profile/person-profile';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-person-crud',
  standalone: true,
  imports: [
    PersonTableComponent,
    PersonFormComponent,
    PersonExitDialogComponent,
    PersonLeaveDialogComponent,
    PersonProfileComponent,
    ButtonModule,
    ProgressSpinnerModule,
    ToastModule,
  ],
  templateUrl: './person-crud.html',
  styleUrl: './person-crud.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonCrudComponent implements OnInit {
  /** Route'dan gelen userdef değeri. */
  readonly USERDEF: UserDef;
  readonly UserDef = UserDef;

  persons: Person[] = [];
  allPersons: Person[] = [];
  isLoading = false;
  errorMessage = '';
  showAddDialog = false;
  editPerson: Person | null = null;
  showExitDialog = false;
  exitPerson: Person | null = null;
  exitMode: 'exit' | 'restore' = 'exit';
  showLeaveDialog = false;
  leavePerson: Person | null = null;
  showProfileModal = false;
  selectedProfilePerson: Person | null = null;

  private personService = inject(PersonService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.USERDEF = Number(this.route.snapshot.data['userDef']) as UserDef;
  }

  // ─── Derived labels ───

  get pageTitle(): string {
    return getUserDefLabel(this.USERDEF) + 'ler';
  }

  get addLabel(): string {
    return getUserDefLabel(this.USERDEF) + ' Ekle';
  }

  get formTitle(): string {
    return this.editPerson
      ? getUserDefLabel(this.USERDEF) + ' Düzenle'
      : 'Yeni ' + getUserDefLabel(this.USERDEF) + ' Ekle';
  }

  get descriptionText(): string {
    return (
      getUserDefLabel(this.USERDEF) +
      ' listesini buradan görüntüleyebilir ve yeni kayıt ekleyebilirsiniz.'
    );
  }

  /** Tüm personel tiplerinde profil modalı gösterilir. */
  readonly hasProfileModal = true;

  /** İşlem kolu sadece Ogrenci sayfasında gösterilir (İzin Ata). */
  get showActionsColumn(): boolean {
    return this.USERDEF === UserDef.Ogrenci;
  }

  /** Ogrenci ve Veli sayfalarında allPersons gereklidir. */
  get needsAllPersons(): boolean {
    return this.USERDEF !== UserDef.Ogretmen;
  }

  /** Tablo sütun başlıkları — userdef'a göre farklılık gösterir. */
  get columnOverrides(): { field: string; header: string }[] {
    if (this.USERDEF === UserDef.Ogrenci) {
      return [
        { field: 'personelno', header: 'Veliler' },
        { field: 'linkedTeachers', header: 'Öğretmenler' },
      ];
    }
    if (this.USERDEF === UserDef.Veli) {
      return [{ field: 'personelno', header: 'Çocuklar' }];
    }
    return [];
  }

  // ─── Lifecycle ───

  ngOnInit() {
    this.fetchPersonList();
  }

  // ─── Data ───

  fetchPersonList(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.personService
      .getPersonList()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: Person[]) => {
          if (this.needsAllPersons) {
            this.allPersons = data;
          }
          this.persons = data.filter((p) => p.userdef === this.USERDEF);
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.errorMessage = 'Sistem hatası: Personel listesi sunucudan çekilemedi.';
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  // ─── Dialog open / close ───

  openAddDialog(): void {
    this.editPerson = null;
    this.showAddDialog = true;
  }

  onRowClick(person: Person): void {
    this.selectedProfilePerson = person;
    this.showProfileModal = true;
  }

  onEditDialogClose(): void {
    this.editPerson = null;
  }

  onPersonSaved(response: unknown): void {
    const personData = unwrapResponse(response) as Person;

    // Bidirectional sync: Ogrenci hem PersonLinks hem TeacherLinks senkronize eder,
    // sadece PersonLinks senkronize eder.
    if (personData?.id && this.needsAllPersons) {
      const newLinkedIds = extractLinkedPersonIds(personData.personelno);
      if (newLinkedIds.length > 0) {
        this.personService.updatePersonLinks(personData.id, newLinkedIds, this.allPersons);
      }

      if (this.USERDEF === UserDef.Ogrenci) {
        const newTeacherIds = extractLinkedTeacherIds(personData.personelno);
        if (newTeacherIds.length > 0) {
          this.personService.updateTeacherLinks(personData.id, newTeacherIds, this.allPersons);
        }
      }
    }

    this.editPerson = null;
    this.fetchPersonList();
  }

  // ─── Exit / Restore ───

  onExitDialogClose(): void {
    this.exitPerson = null;
  }

  onExitConfirmed(): void {
    this.exitPerson = null;
    this.fetchPersonList();
  }

  // ─── Leave ───

  onLeaveRequest(person: Person): void {
    this.leavePerson = person;
    this.showLeaveDialog = true;
  }

  onLeaveDialogClose(): void {
    this.leavePerson = null;
  }

  onLeaveConfirmed(message: string): void {
    this.leavePerson = null;

    this.messageService.add({
      severity: 'success',
      summary: 'Başarılı',
      detail: message,
      life: 3000,
    });

    this.fetchPersonList();
  }

  // ─── Profile modal ───

  onLinkedPersonClick(person: Person): void {
    this.selectedProfilePerson = person;
  }

  onEditRequest(person: Person): void {
    this.showProfileModal = false;
    this.editPerson = person;
    this.showAddDialog = true;
  }

  onProfileExitRequest(person: Person): void {
    this.showProfileModal = false;
    this.exitPerson = person;
    this.exitMode = 'exit';
    this.showExitDialog = true;
  }

  onProfileRestoreRequest(person: Person): void {
    this.showProfileModal = false;
    this.exitPerson = person;
    this.exitMode = 'restore';
    this.showExitDialog = true;
  }

  getLinkedIds(person: Person): number[] {
    return extractLinkedPersonIds(person.personelno);
  }
}
