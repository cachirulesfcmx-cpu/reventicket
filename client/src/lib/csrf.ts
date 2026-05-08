let csrfToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

let currentIdempotencyKey: string | null = null;
let idempotencyKeyLocked: boolean = false;

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function getOrCreateIdempotencyKey(): string {
  if (!currentIdempotencyKey || !idempotencyKeyLocked) {
    currentIdempotencyKey = generateIdempotencyKey();
  }
  return currentIdempotencyKey;
}

export function lockIdempotencyKey(): void {
  if (!currentIdempotencyKey) {
    currentIdempotencyKey = generateIdempotencyKey();
  }
  idempotencyKeyLocked = true;
}

export function clearIdempotencyKey(): void {
  currentIdempotencyKey = null;
  idempotencyKeyLocked = false;
}

export function invalidateIdempotencyKey(): void {
  currentIdempotencyKey = null;
  idempotencyKeyLocked = false;
}

export async function getCSRFToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }

  if (tokenPromise) {
    return tokenPromise;
  }

  tokenPromise = fetch("/api/csrf", {
    credentials: "include",
  })
    .then((res) => res.json())
    .then((data) => {
      csrfToken = data.token;
      tokenPromise = null;
      return csrfToken!;
    })
    .catch((err) => {
      tokenPromise = null;
      console.error("Error fetching CSRF token:", err);
      return "";
    });

  return tokenPromise;
}

export function invalidateCSRFToken() {
  csrfToken = null;
  tokenPromise = null;
}

export function clearCSRFToken() {
  csrfToken = null;
  tokenPromise = null;
}

async function doFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method?.toUpperCase() || "GET";
  const safeMethods = ["GET", "HEAD", "OPTIONS"];

  if (safeMethods.includes(method)) {
    return fetch(url, {
      ...options,
      credentials: "include",
    });
  }

  const token = await getCSRFToken();

  const headers = new Headers(options.headers);
  headers.set("Content-Type", options.headers?.toString().includes("multipart") ? "" : "application/json");
  if (token) {
    headers.set("x-csrf-token", token);
  }
  
  if (!headers.get("Content-Type")) {
    headers.delete("Content-Type");
  }

  return fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });
}

export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await doFetch(url, options);
  
  if (response.status === 403) {
    const cloned = response.clone();
    try {
      const data = await cloned.json();
      if (data.code === 'CSRF_INVALID' || data.code === 'CSRF_NO_SESSION') {
        invalidateCSRFToken();
        const retryResponse = await doFetch(url, options);
        return retryResponse;
      }
    } catch {
    }
  }
  
  return response;
}

export async function apiRequest<T = any>(
  method: string,
  url: string,
  data?: any,
  options?: { useIdempotencyKey?: boolean }
): Promise<T> {
  const requestOptions: RequestInit = {
    method,
  };

  if (data !== undefined) {
    requestOptions.body = JSON.stringify(data);
  }

  let res: Response;
  
  if (options?.useIdempotencyKey) {
    lockIdempotencyKey();
    const idempKey = getOrCreateIdempotencyKey();
    res = await fetchWithIdempotencyKey(url, requestOptions, idempKey);
  } else {
    res = await fetchWithCSRF(url, requestOptions);
  }
  
  const json = await res.json();

  if (!res.ok) {
    const error = new Error(json.error || "Error en la solicitud") as Error & { status?: number; code?: string };
    error.status = res.status;
    error.code = json.code;
    throw error;
  }

  if (options?.useIdempotencyKey) {
    clearIdempotencyKey();
  }

  return json;
}

async function fetchWithIdempotencyKey(
  url: string,
  options: RequestInit,
  idempotencyKey: string
): Promise<Response> {
  const method = options.method?.toUpperCase() || "GET";
  const token = await getCSRFToken();

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("x-csrf-token", token);
  }
  headers.set("Idempotency-Key", idempotencyKey);

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });
  
  if (response.status === 403) {
    const cloned = response.clone();
    try {
      const data = await cloned.json();
      if (data.code === 'CSRF_INVALID' || data.code === 'CSRF_NO_SESSION') {
        invalidateCSRFToken();
        const newToken = await getCSRFToken();
        headers.set("x-csrf-token", newToken);
        return fetch(url, {
          ...options,
          credentials: "include",
          headers,
        });
      }
    } catch {
    }
  }
  
  return response;
}
