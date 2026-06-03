const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/beshow';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: {
    request_id: string;
    timestamp: string;
  };
}

function unwrapPayload<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return (payload as ApiEnvelope<T>).data;
  }
  return payload as T;
}

export function getApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    headers: {
      Accept: 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const payload = (await response.json()) as unknown;
  return unwrapPayload<T>(payload);
}

export async function postJson<TBody extends object, TData = Record<string, unknown>>(
  path: string,
  body: TBody,
): Promise<TData> {
  const response = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const payload = (await response.json()) as unknown;
  return unwrapPayload<TData>(payload);
}

export async function patchJson<TBody extends object, TData = Record<string, unknown>>(
  path: string,
  body: TBody,
): Promise<TData> {
  const response = await fetch(getApiUrl(path), {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);

  const payload = (await response.json()) as unknown;
  return unwrapPayload<TData>(payload);
}