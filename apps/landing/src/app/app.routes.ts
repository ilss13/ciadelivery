import { Route } from '@angular/router';
import { HomePage } from './features/home/home-page';
import { PrivacyPage } from './features/legal/privacy-page';
import { TermsPage } from './features/legal/terms-page';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', component: HomePage },
  { path: 'privacidade', component: PrivacyPage },
  { path: 'termos', component: TermsPage },
];
