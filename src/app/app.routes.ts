import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { UserDef } from './core/models/person.model';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'home',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./features/layout/pages/layout/layout').then((m) => m.LayoutComponent),
    children: [
      //{ path: '', redirectTo: 'anasayfa', pathMatch: 'full' },
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard/dashboard').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'students',
        data: { userDef: UserDef.Ogrenci },
        loadComponent: () =>
          import('./features/persons/pages/person-crud/person-crud').then(
            (m) => m.PersonCrudComponent,
          ),
      },
      {
        path: 'teachers',
        data: { userDef: UserDef.Ogretmen },
        loadComponent: () =>
          import('./features/persons/pages/person-crud/person-crud').then(
            (m) => m.PersonCrudComponent,
          ),
      },
      {
        path: 'parents',
        data: { userDef: UserDef.Veli },
        loadComponent: () =>
          import('./features/persons/pages/person-crud/person-crud').then(
            (m) => m.PersonCrudComponent,
          ),
      },
      {
        path: 'transport',
        loadComponent: () =>
          import('./features/transport/pages/school-bus/school-bus').then(
            (m) => m.SchoolBusComponent,
          ),
      },
      {
        path: 'activities',
        loadComponent: () =>
          import('./features/activities/pages/activities-list/activities-list').then(
            (m) => m.ActivitiesComponent,
          ),
      },
    ],
  },
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: '/login',
  },
];
