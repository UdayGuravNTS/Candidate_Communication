export type ApplicationEnvironment = 'development' | 'staging' | 'production';
export type ApplicationLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Environment {
  apiUrl: string;
  apiTimeout: number;
  appVersion: string;
  environment: ApplicationEnvironment;
  logLevel: ApplicationLogLevel;
  maxRetries: number;
  retryDelay: number;
}

function getApiBaseUrl(): string {
  const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
  if (configuredApiUrl) {
    return configuredApiUrl.replace(/\/+$/, '');
  }

  const { hostname } = window.location;
  switch (true) {
    case hostname === '13.201.107.121':
      return 'http://13.201.107.121:8006/api';

    default:
      // Uses same-origin /api (works with Vite proxy, vercel dev, and production rewrites)
      return '/api';
  }
}

const apiUrl = getApiBaseUrl();
const appVersion = import.meta.env.VITE_APP_VERSION || '0.0.0';

const environments: Record<ApplicationEnvironment, Environment> = {
  development: {
    apiUrl,
    apiTimeout: 30000,
    appVersion,
    environment: 'development',
    logLevel: 'debug',
    maxRetries: 1,
    retryDelay: 1000
  },
  staging: {
    apiUrl,
    apiTimeout: 30000,
    appVersion,
    environment: 'staging',
    logLevel: 'info',
    maxRetries: 2,
    retryDelay: 2000
  },
  production: {
    apiUrl,
    apiTimeout: 30000,
    appVersion,
    environment: 'production',
    logLevel: 'error',
    maxRetries: 3,
    retryDelay: 3000
  }
};

const mode = import.meta.env.MODE;
const currentEnvironment: ApplicationEnvironment =
  mode === 'production' || mode === 'staging' ? mode : 'development';

export const environment = environments[currentEnvironment];
