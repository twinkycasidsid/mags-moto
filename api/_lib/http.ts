export interface ApiRequestLike {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface ApiResponseLike {
  status: (code: number) => ApiResponseLike;
  json: (body: unknown) => void;
  send: (body?: unknown) => void;
  setHeader: (name: string, value: string | string[]) => void;
}

export const sendJson = (res: ApiResponseLike, status: number, body: unknown) => {
  res.status(status).json(body);
};

export const sendError = (res: ApiResponseLike, status: number, message: string) => {
  sendJson(res, status, { error: message });
};

export const methodNotAllowed = (res: ApiResponseLike, allowed: string[]) => {
  res.setHeader('Allow', allowed);
  sendError(res, 405, 'Method not allowed.');
};

export const handleOptions = (req: ApiRequestLike, res: ApiResponseLike, allowed: string[]) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', [...allowed, 'OPTIONS']);
    res.status(204).send();
    return true;
  }

  return false;
};
