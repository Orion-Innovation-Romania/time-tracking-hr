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
const PUBLIC_AUTH_PATHS = new Set([
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh',
]);

function authPath(path: string): string {
  return path.split('?')[0];
}

function sendToLoginIfUnauthorized(path: string, statusCode: number) {
  if (statusCode !== 401) return;
  if (PUBLIC_AUTH_PATHS.has(authPath(path))) return;
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
    if (isAbortError(err)) throw err;
    throw new ApiRequestError({
      statusCode: 0,
      message: UNAVAILABLE_MESSAGE,
      raw: err,
    });
  }
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

/** One in-flight refresh so parallel 401s don't rotate the token twice. */
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = request(buildUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function fetchWithRefresh(path: string, init: RequestInit, query?: RequestOptions['query']): Promise<Response> {
  const url = buildUrl(path, query);
  const res = await request(url, init);
  if (res.status !== 401) return res;
  if (PUBLIC_AUTH_PATHS.has(authPath(path))) return res;
  const refreshed = await tryRefresh();
  if (!refreshed) return res;
  return request(url, init);
}

export async function api<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, query, signal } = options;
  const res = await fetchWithRefresh(
    path,
    {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
      cache: 'no-store',
    },
    query,
  );

  if (!res.ok) await fail(res, path);

  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

/** Upload multipart form data (used by import preview). */
export async function apiUpload<T = unknown>(
  path: string,
  form: FormData,
): Promise<T> {
  const res = await fetchWithRefresh(path, {
    method: 'POST',
    credentials: 'include',
    body: form,
    cache: 'no-store',
  });
  if (!res.ok) await fail(res, path);
  return (await res.json()) as T;
}

/** Download a binary export and trigger a browser save. */
export interface DownloadResult {
  filename: string;
  emailed: 'sent' | 'skipped' | 'failed' | null;
  emailTo: string | null;
  emailError: string | null;
}

export async function apiDownload(
  path: string,
  body: unknown,
  fallbackName: string,
): Promise<DownloadResult> {
  const res = await fetchWithRefresh(path, {
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
  const emailedRaw = res.headers.get('x-ttah-emailed');
  const emailed =
    emailedRaw === 'sent' || emailedRaw === 'skipped' || emailedRaw === 'failed' ? emailedRaw : null;
  const emailErrorHeader = res.headers.get('x-ttah-email-error');

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return {
    filename: name,
    emailed,
    emailTo: res.headers.get('x-ttah-email-to'),
    emailError: emailErrorHeader ? decodeURIComponent(emailErrorHeader) : null,
  };
}
