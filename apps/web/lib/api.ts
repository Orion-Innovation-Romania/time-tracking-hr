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

export async function api<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, query, signal } = options;
  const res = await fetch(buildUrl(path, query), {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new ApiRequestError(await parseError(res));
  }

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
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    credentials: 'include',
    body: form,
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiRequestError(await parseError(res));
  return (await res.json()) as T;
}

/** Download a binary export and trigger a browser save. */
export async function apiDownload(
  path: string,
  body: unknown,
  fallbackName: string,
): Promise<void> {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) throw new ApiRequestError(await parseError(res));

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
