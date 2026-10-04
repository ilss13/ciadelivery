import { environment } from '../../environments/environment';

export function apiUrl(path: string): string {
  const base = environment.apiUrl.replace(/\/$/, '');
  return `${base}${path}`;
}
