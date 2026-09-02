import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { UserDef } from './core/models/person.model';

export const routes: Routes = [
  {
    path: 'login',
    //data: { titleKey: 'LOGIN.TITLE' },
    loadComponent: () => import('./features/auth/pages/login/login').then((m) => m.LoginComponent),
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
        //data: { titleKey: 'DASHBOARD.TITLE' },
        data: { scrollable: true },
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard/dashboard').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'students',
        data: { userDef: UserDef.Ogrenci, titleKey: 'MENU.STUDENTS' },
        loadComponent: () =>
          import('./features/persons/pages/person-crud/person-crud').then(
            (m) => m.PersonCrudComponent,
          ),
      },
      {
        path: 'teachers',
        data: { userDef: UserDef.Ogretmen, titleKey: 'MENU.TEACHERS' },
        loadComponent: () =>
          import('./features/persons/pages/person-crud/person-crud').then(
            (m) => m.PersonCrudComponent,
          ),
      },
      {
        path: 'proxies',
        data: { titleKey: 'MENU.PROXIES' },
        loadComponent: () =>
          import('./features/persons/pages/proxy-list/proxy-list').then(
            (m) => m.ProxyListComponent,
          ),
      },
      {
        path: 'parents',
        data: { userDef: UserDef.Veli, titleKey: 'MENU.PARENTS' },
        loadComponent: () =>
          import('./features/persons/pages/person-crud/person-crud').then(
            (m) => m.PersonCrudComponent,
          ),
      },
      {
        path: 'transport',
        data: { titleKey: 'MENU.TRANSPORT', scrollable: true },
        loadComponent: () =>
          import('./features/transport/pages/school-bus/school-bus').then(
            (m) => m.SchoolBusComponent,
          ),
      },
      {
        path: 'activities',
        data: { titleKey: 'MENU.ACTIVITIES' },
        loadComponent: () =>
          import('./features/activities/pages/activities-list/activities-list').then(
            (m) => m.ActivitiesComponent,
          ),
      },
      {
        path: 'attendance',
        data: { titleKey: 'MENU.STUDENT_ATTENDANCE' },
        loadComponent: () =>
          import('./features/attendance/pages/attendance-list/attendance-list').then(
            (m) => m.AttendanceListComponent,
          ),
      },
      {
        path: 'photo-approval',
        data: { titleKey: 'MENU.PHOTO_APPROVAL', scrollable: true }, // Varsa i18n key'in
        loadComponent: () =>
          import('./features/persons/pages/photo-approval/photo-approval').then(
            (m) => m.PhotoApprovalComponent,
          ),
      },
      {
        path: 'school-hours',
        data: { titleKey: 'MENU.SCHOOL_HOURS', scrollable: true },
        loadComponent: () =>
          import('./features/school-hours/pages/school-hours-list/school-hours-list').then(
            (m) => m.SchoolHoursListComponent,
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
