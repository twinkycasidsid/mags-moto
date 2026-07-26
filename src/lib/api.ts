import { env } from './env';

export const apiFetch = async <T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> => {
  const normalizedBaseUrl = env.apiBaseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const requestUrl = normalizedBaseUrl ? `${normalizedBaseUrl}${normalizedPath}` : normalizedPath;

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error('Unable to reach the server. Check your connection and try again.');
  }

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
    } else if (response.status === 401) {
      message = 'Your session has expired. Please sign in again.';
    } else if (response.status === 403) {
      message = 'You do not have permission to perform this action.';
    } else if (response.status >= 500) {
      message = 'The server encountered an error. Please try again.';
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};
