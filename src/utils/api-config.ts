import { StateStore } from '../state/store';

let storeInstance: StateStore | null = null;

export function initializeApiConfig(store: StateStore): void {
  storeInstance = store;
}

export function getServerUrl(): string {
  // Priority: explicit server URL > environment variable > default
  if (storeInstance) {
    const preferences = storeInstance.getPreferences();
    if (preferences.serverUrl && preferences.serverUrl.trim()) {
      return preferences.serverUrl;
    }
  }

  // Check environment/config
  const envUrl = process.env.VSCODE_PAIR_SERVER_URL || process.env.REACT_APP_SERVER_URL;
  if (envUrl) {
    return envUrl;
  }

  // Default fallback (will be overridden in production via extension settings)
  return 'https://pairwithcode.onrender.com';
}

export function buildApiUrl(endpoint: string): string {
  const baseUrl = getServerUrl();
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${cleanBase}${cleanEndpoint}`;
}

export function buildSocketUrl(): string {
  const baseUrl = getServerUrl();
  // Convert HTTPS to WSS, HTTP to WS
  if (baseUrl.startsWith('https://')) {
    return baseUrl.replace('https://', 'wss://');
  }
  if (baseUrl.startsWith('http://')) {
    return baseUrl.replace('http://', 'ws://');
  }
  return baseUrl;
}

/**
 * Fetch with automatic server URL resolution
 */
export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = buildApiUrl(endpoint);
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

/**
 * POST request helper
 */
export async function apiPost(endpoint: string, data: any, options: RequestInit = {}): Promise<Response> {
  return apiCall(endpoint, {
    ...options,
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * GET request helper
 */
export async function apiGet(endpoint: string, options: RequestInit = {}): Promise<Response> {
  return apiCall(endpoint, {
    ...options,
    method: 'GET',
  });
}

/**
 * PATCH request helper
 */
export async function apiPatch(endpoint: string, data: any, options: RequestInit = {}): Promise<Response> {
  return apiCall(endpoint, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * DELETE request helper
 */
export async function apiDelete(endpoint: string, options: RequestInit = {}): Promise<Response> {
  return apiCall(endpoint, {
    ...options,
    method: 'DELETE',
  });
}
