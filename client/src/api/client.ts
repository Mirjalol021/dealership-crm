// Thin fetch wrapper. Sends cookies, JSON, and surfaces API errors.

export class ApiError extends Error {
  status: number;
  code: string;
  /** Field-level validation details, when the server returns them (zod flatten()). */
  details?: { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
  /** Optional human-readable message from the server. */
  serverMessage?: string;

  constructor(
    status: number,
    code: string,
    details?: ApiError['details'],
    serverMessage?: string,
  ) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
    this.serverMessage = serverMessage;
  }

  /** A short, user-facing summary naming the offending fields (if any). */
  friendly(): string {
    if (this.details?.fieldErrors) {
      const fields = Object.keys(this.details.fieldErrors);
      if (fields.length) return `${this.code}: ${fields.join(', ')}`;
    }
    if (this.serverMessage) return this.serverMessage;
    return this.code;
  }
}

// Called when the session is no longer valid (401), so the app can redirect to login.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: { error?: string; details?: ApiError['details']; message?: string } = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    // Session expired / not authenticated — let the app react (redirect to login).
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      onUnauthorized?.();
    }
    throw new ApiError(
      res.status,
      data?.error ?? 'REQUEST_FAILED',
      data?.details,
      data?.message,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
