import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { UserDef } from './core/person.model';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'home',
    canActivate: [AuthGuard],
    loadComponent: () => import('./layout/layout').then((m) => m.LayoutComponent),
    children: [
      //{ path: '', redirectTo: 'anasayfa', pathMatch: 'full' },
      {
        path: '',
        loadComponent: () => import('./dashboard/dashboard').then((m) => m.DashboardComponent),
      },
      {
        path: 'students',
        data: { userDef: UserDef.Ogrenci },
        loadComponent: () =>
          import('./person-crud-page/person-crud-page').then((m) => m.PersonCrudPageComponent),
      },
      {
        path: 'teachers',
        data: { userDef: UserDef.Ogretmen },
        loadComponent: () =>
          import('./person-crud-page/person-crud-page').then((m) => m.PersonCrudPageComponent),
      },
      {
        path: 'parents',
        data: { userDef: UserDef.Veli },
        loadComponent: () =>
          import('./person-crud-page/person-crud-page').then((m) => m.PersonCrudPageComponent),
      },
      {
        path: 'transport',
        loadComponent: () => import('./school-bus/school-bus').then((m) => m.SchoolBusComponent),
      },
      {
        path: 'activities',
        loadComponent: () => import('./activities/activities').then((m) => m.ActivitiesComponent),
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
