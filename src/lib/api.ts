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
    const responseText = await response.text().catch(() => '');
    let message = 'Request failed';

    if (responseText) {
      try {
        const parsed = JSON.parse(responseText) as { error?: string; message?: string };
        message = parsed.error ?? parsed.message ?? responseText;
      } catch {
        message = responseText;
      }
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};
