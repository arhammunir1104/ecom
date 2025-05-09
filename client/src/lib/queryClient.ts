import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // Try to parse as JSON first
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorJson = await res.json();
        throw new Error(errorJson.message || `${res.status}: ${res.statusText}`);
      } else {
        // Not JSON, get as text
        const text = await res.text();
        // Create a more user-friendly error message
        if (res.status === 503) {
          throw new Error("Server is currently unavailable. Please try again later.");
        } else {
          throw new Error(`Error ${res.status}: ${text || res.statusText}`);
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      // Fallback if we can't parse the error
      throw new Error(`Request failed with status ${res.status}`);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Add user ID to headers for authenticated requests
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  
  // Get the logged-in user from localStorage to add user ID to header
  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    try {
      const userData = JSON.parse(storedUser);
      if (userData && userData.id) {
        headers["X-User-ID"] = userData.id.toString();
      }
      // Add Firebase UID if available
      if (userData && userData.uid) {
        headers["Firebase-UID"] = userData.uid;
        console.log("Added Firebase UID to request header:", userData.uid);
      }
    } catch (e) {
      console.error("Error parsing user data from localStorage:", e);
    }
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Add user ID to headers for authenticated requests
    const headers: Record<string, string> = {};
    
    // Get the logged-in user from localStorage to add user ID to header
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        if (userData && userData.id) {
          headers["X-User-ID"] = userData.id.toString();
        }
        // Add Firebase UID if available
        if (userData && userData.uid) {
          headers["Firebase-UID"] = userData.uid;
          console.log("Added Firebase UID to query header:", userData.uid);
        }
      } catch (e) {
        console.error("Error parsing user data from localStorage:", e);
      }
    }
    
    // Build URL with query parameters if they exist
    let url = queryKey[0] as string;
    const params = queryKey[1] as Record<string, any>;
    
    if (params) {
      const searchParams = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
      
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }
    
    const res = await fetch(url, {
      credentials: "include",
      headers,
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
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
