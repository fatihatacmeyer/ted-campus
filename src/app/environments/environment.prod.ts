import { AppConfig } from '../core/services/app-config.service';
import { baseEnvironment } from './environment.base';

export const environment: AppConfig = {
  ...baseEnvironment,
  production: true,
  apiUrl: '',
  reportBaseUrl: '',
  photoBaseUrl: '',
};
