import { AppConfig } from '../core/services/app-config.service';
import { baseEnvironment } from './environment.base';

export const environment: AppConfig = {
  ...baseEnvironment,
  production: false,
  apiUrl: 'http://10.20.24.27:1323/api',
  reportBaseUrl: 'http://10.20.24.27:1323',
  photoBaseUrl: 'http://localhost/MeCampus/ProfilFotograflari',
};
