const AUTH_EMAIL_DOMAIN = 'auth.magsmoto.local';

export const normalizeUsername = (username: string) => username.trim().toLowerCase();

export const usernameToAuthEmail = (username: string) =>
  `${normalizeUsername(username)}@${AUTH_EMAIL_DOMAIN}`;
