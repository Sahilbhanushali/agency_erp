const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5007";

const ACCESS_TOKEN_KEY = "agencyos_access_token";
const REFRESH_TOKEN_KEY = "agencyos_refresh_token";

/** Shape returned by every list endpoint. */
export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; pageCount: number };
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  skipAuth?: boolean;
  isFormData?: boolean;
}

async function extractErrorMessage(response: Response) {
  try {
    const data = await response.json();
    if (Array.isArray(data.message)) return data.message.join(", ");
    return data.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

async function rawRequest(path: string, options: RequestOptions) {
  const headers: HeadersInit = {};
  let body: BodyInit | undefined;

  if (options.isFormData) {
    body = options.body as FormData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  if (!options.skipAuth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${API_URL}${path}`, { method: options.method ?? "GET", headers, body });
}

// Shared by every caller that hits a 401 at once, so a page firing several parallel requests
// triggers exactly one /auth/refresh instead of a duplicate-token race against the single-use
// refresh token (the backend revokes-then-reissues, so concurrent refreshes fail each other).
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    const response = await rawRequest("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
      skipAuth: true,
    });
    if (!response.ok) return false;

    const data = await response.json();
    setTokens(data.accessToken, data.refreshToken);
    return true;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await rawRequest(path, options);

  if (response.status === 401 && !options.skipAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await rawRequest(path, options);
    } else {
      clearTokens();
    }
  }

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function download(path: string, filename: string): Promise<void> {
  let response = await rawRequest(path, {});

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await rawRequest(path, {});
  }

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  /**
   * Fetches a list endpoint and unwraps the page, so a caller that just needs the
   * rows reads like a plain array fetch. Callers that need `meta` (a paged table)
   * use the usePaginatedList hook instead.
   *
   * ponytail: pickers take a flat ceiling rather than searching server-side.
   * Swap an individual picker to a search-as-you-type Combobox when one outgrows it.
   */
  list: <T>(path: string, limit = 200) =>
    apiRequest<Paginated<T>>(
      `${path}${path.includes("?") ? "&" : "?"}limit=${limit}`
    ).then((result) => result.data),
  post: <T>(path: string, body?: unknown, options?: Partial<RequestOptions>) =>
    apiRequest<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
  download,
};
