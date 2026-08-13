export interface ApiFailure {
  statusCode: number;
  message: string;
  raw?: unknown;
}

export class ApiRequestError extends Error {
  statusCode: number;
  raw?: unknown;
  constructor(failure: ApiFailure) {
    super(failure.message);
    this.name = 'ApiRequestError';
    this.statusCode = failure.statusCode;
    this.raw = failure.raw;
  }
}

const UNAVAILABLE_MESSAGE =
  'Cannot reach the server. The API or database may be down.';

export function isServiceUnavailable(err: unknown): boolean {
  if (err instanceof ApiRequestError) {
    if (err.statusCode === 0 || err.statusCode >= 500) return true;
    return /ECONNREFUSED|Failed to proxy|Can't reach database|P1001/i.test(err.message);
  }
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    return /ECONNREFUSED|Failed to proxy|network|fetch/i.test(err.message);
  }
  return false;
}

export function unavailableMessage(err?: unknown): string {
  if (err instanceof ApiRequestError && /Can't reach database|P1001/i.test(err.message)) {
    return 'Cannot connect to the database. Please try again in a moment.';
  }
  return UNAVAILABLE_MESSAGE;
}

// Same-origin: '/api' is served by Caddy (prod) or Next rewrite (dev).
const BASE = '/api';

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function parseError(res: Response): Promise<ApiFailure> {
  try {
    const data = await res.json();
    const message = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message || res.statusText;
    return { statusCode: res.status, message, raw: data };
  } catch {
    return { statusCode: res.status, message: res.statusText };
  }
}

/** Login/forgot/refresh 401s are expected (bad password, no cookie). Everything else means the session is dead. */
const PUBLIC_AUTH_PATHS = new Set(['/auth/login', '/auth/forgot-password', '/auth/refresh']);

function sendToLoginIfUnauthorized(path: string, statusCode: number) {
  if (statusCode !== 401) return;
  if (PUBLIC_AUTH_PATHS.has(path.split('?')[0])) return;
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  window.location.replace('/login');
}

async function fail(res: Response, path: string): Promise<never> {
  const failure = await parseError(res);
  sendToLoginIfUnauthorized(path, failure.statusCode);
  throw new ApiRequestError(failure);
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    throw new ApiRequestError({
      statusCode: 0,
      message: UNAVAILABLE_MESSAGE,
      raw: err,
    });
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, query, signal } = options;
  const res = await request(buildUrl(path, query), {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
    cache: 'no-store',
  });

  if (!res.ok) await fail(res, path);

  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

/** Upload multipart form data (used by PDF import preview). */
export async function apiUpload<T = unknown>(
  path: string,
  form: FormData,
): Promise<T> {
  const res = await request(buildUrl(path), {
    method: 'POST',
    credentials: 'include',
    body: form,
    cache: 'no-store',
  });
  if (!res.ok) await fail(res, path);
  return (await res.json()) as T;
}

/** Download a binary export and trigger a browser save. */
export async function apiDownload(
  path: string,
  body: unknown,
  fallbackName: string,
): Promise<void> {
  const res = await request(buildUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) await fail(res, path);

  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const name = match?.[1] ?? fallbackName;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
