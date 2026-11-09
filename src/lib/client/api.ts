"use client";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const { json, headers, timeoutMs, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      headers: json !== undefined ? { "content-type": "application/json", ...headers } : headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: "same-origin",
      ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    throw new ApiError(0, name === "TimeoutError" || name === "AbortError" ? "timeout" : "network");
  }
  if (res.status === 401) {
    // session expired: full reload to the login page clears client state
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (typeof window !== "undefined") window.location.assign("/login");
    throw new ApiError(401, "unauthorized");
  }
  if (!res.ok) {
    let code = "server_error";
    try {
      code = ((await res.json()) as { error?: string }).error ?? code;
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, code);
  }
  return (await res.json()) as T;
}
