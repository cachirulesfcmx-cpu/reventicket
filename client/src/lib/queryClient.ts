import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const json = await res.clone().json();
      message = json.error || json.message || message;
    } catch {
      try { message = await res.text() || message; } catch {}
    }
    const error = new Error(message) as Error & { status: number };
    error.status = res.status;
    throw error;
  }
}

/** Helper para incluir siempre el token admin si existe */
function getAuthHeaders(): Record<string, string> {
  const adminToken = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  const authToken  = typeof window !== "undefined" ? localStorage.getItem("auth_token")  : null;
  const token = adminToken || authToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2, // 2 min — permite revalidación sin ser agresivo
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
