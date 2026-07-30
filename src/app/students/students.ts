import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { PersonService } from '../services/person.service';
import { Person } from '../core/person.model';
import { PersonTableComponent } from '../shared/person-table/person-table';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [PersonTableComponent],
  templateUrl: './students.html',
  styleUrl: './students.scss',
})
export class StudentsComponent implements OnInit {
  persons: Person[] = [];
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(
    private personService: PersonService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.fetchPersonList();
  }

  fetchPersonList(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.personService.getPersonList().subscribe({
      next: (data: Person[]) => {
        this.persons = data.filter((p) => p.userdef === 11);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Personel listesi yüklenirken hata oluştu:', err);
        this.errorMessage = 'Sistem hatası: Personel listesi sunucudan çekilemedi.';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }
}
