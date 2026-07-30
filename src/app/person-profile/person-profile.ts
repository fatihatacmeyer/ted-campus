import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { Person, LinkedPerson, extractLinkedPersonIds, extractLinkedTeacherIds, resolveLinkedNames } from '../core/person.model';

@Component({
  selector: 'app-person-profile',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule],
  templateUrl: './person-profile.html',
  styleUrl: './person-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonProfileComponent {
  @Input() visible = false;
  @Input() person: Person | null = null;
  @Input() allPersons: Person[] = [];
  @Input() userdefContext = 11;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() personClick = new EventEmitter<Person>();
  @Output() editRequest = new EventEmitter<Person>();
  @Output() exitRequest = new EventEmitter<Person>();
  @Output() restoreRequest = new EventEmitter<Person>();

  get linkedPersons(): LinkedPerson[] {
    if (!this.person) return [];
    const ids = extractLinkedPersonIds(this.person.personelno);
    if (ids.length === 0) return [];
    return resolveLinkedNames(ids, this.allPersons);
  }

  get linkedTeachers(): LinkedPerson[] {
    if (!this.person) return [];
    const ids = extractLinkedTeacherIds(this.person.personelno);
    if (ids.length === 0) return [];
    return resolveLinkedNames(ids, this.allPersons);
  }

  /** Öğrenci (11) ise hem veliler hem öğretmenler görünür */
  get showLinkedPersons(): boolean {
    const ctx = this.person?.userdef ?? this.userdefContext;
    return ctx === 11 || ctx === 13;
  }

  get showLinkedTeachers(): boolean {
    const ctx = this.person?.userdef ?? this.userdefContext;
    return ctx === 11;
  }

  /** Dinamik label — tıklanan kişinin userdef değerine göre */
  get linkedPersonsLabel(): string {
    const ctx = this.person?.userdef ?? this.userdefContext;
    if (ctx === 11) return 'Veliler';
    if (ctx === 13) return 'Çocuklar';
    return 'Bağlantılı Kişiler';
  }

  /** Dinamik label — öğretmenler bölümü için */
  get linkedTeachersLabel(): string {
    const ctx = this.person?.userdef ?? this.userdefContext;
    if (ctx === 11) return 'Öğretmenler';
    return 'Bağlantılı Öğretmenler';
  }

  get hasLinkedPersons(): boolean {
    return this.linkedPersons.length > 0;
  }

  get hasLinkedTeachers(): boolean {
    return this.linkedTeachers.length > 0;
  }

  onLinkedPersonClick(linked: LinkedPerson): void {
    const found = this.allPersons.find(p => p.id === linked.id);
    if (found) {
      this.personClick.emit(found);
    }
  }

  onEditClick(): void {
    if (this.person) {
      this.editRequest.emit(this.person);
    }
  }

  get isPersonActive(): boolean {
    return this.person ? !this.person.cikistarih : false;
  }

  onExitClick(): void {
    if (this.person) {
      this.exitRequest.emit(this.person);
    }
  }

  onRestoreClick(): void {
    if (this.person) {
      this.restoreRequest.emit(this.person);
    }
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
