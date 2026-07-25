import { env } from './env';

export const apiFetch = async <T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> => {
  const normalizedBaseUrl = env.apiBaseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const requestUrl = normalizedBaseUrl ? `${normalizedBaseUrl}${normalizedPath}` : normalizedPath;

  const response = await fetch(requestUrl, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error ?? 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};
