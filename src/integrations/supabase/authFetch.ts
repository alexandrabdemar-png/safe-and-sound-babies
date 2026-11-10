// fetch for the Supabase client: puts a time limit on Supabase *auth*
// requests (sign-in, sign-up, token refresh…) and logs each one's status code
// and duration to the auth diagnostics log.
//
// Without a limit, a stalled connection can leave an auth request pending
// until iOS gives up, which shows up as an endless spinner, or as every data
// request waiting on a token refresh that never finishes. When the limit
// hits, the request is aborted; supabase-js then returns an ordinary error,
// which the UI already handles.
//
// Auth is bounded at 10 seconds; ordinary data reads at 15 seconds.
import { recordAuthDiagnostic } from "@/lib/authDiagnostics";
import { settleWithin } from '@/lib/promiseTimeout';

type Fetch = typeof fetch;

export const AUTH_REQUEST_TIMEOUT_MS = 10000;
export const DATA_REQUEST_TIMEOUT_MS = 15000;
/** Storage uploads and backend functions (multi-source recall checks) can legitimately be slow. */
export const SLOW_REQUEST_TIMEOUT_MS = 120000;
export const isSlowRequestUrl = (url: string) => /\/storage\/v1\/|\/functions\/v1\//.test(url);

function requestUrl(input: Parameters<Fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** "/auth/v1/token?grant_type=password" — path plus grant type only, never other query values. */
function describePath(url: string): string {
  try {
    const u = new URL(url);
    const grant = u.searchParams.get("grant_type");
    return u.pathname + (grant ? `?grant_type=${grant}` : "");
  } catch {
    return "(unparseable url)";
  }
}

export function createAuthFetch(
  // Called through globalThis rather than stored, since Safari throws
  // "Illegal invocation" for a detached `fetch`.
  baseFetch: Fetch = (input, init) => globalThis.fetch(input, init),
  timeoutMs: number = AUTH_REQUEST_TIMEOUT_MS,
): Fetch {
  return async (input, init) => {
    const url = requestUrl(input);
    const isAuth = url.includes("/auth/v1/");
    const requestTimeout = isAuth ? timeoutMs : isSlowRequestUrl(url) ? SLOW_REQUEST_TIMEOUT_MS : DATA_REQUEST_TIMEOUT_MS;

    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const label = `${method} ${describePath(url)}`;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, requestTimeout);
    const outer = init?.signal;
    const onOuterAbort = () => controller.abort();
    if (outer) {
      if (outer.aborted) controller.abort();
      else outer.addEventListener("abort", onOuterAbort, { once: true });
    }

    const started = Date.now();
    try {
      const res = await settleWithin(baseFetch(input, { ...init, signal: controller.signal }), requestTimeout, isAuth ? 'Auth request' : 'Data request');
      if (isAuth) recordAuthDiagnostic("request", `${label} → ${res.status} (${Date.now() - started}ms)`);
      return res;
    } catch (err) {
      if (timedOut) {
        if (isAuth) recordAuthDiagnostic("timeout", `${label} gave up after ${requestTimeout}ms`);
        throw new Error(`${isAuth ? "Auth" : "Data"} request timed out after ${requestTimeout}ms`);
      }
      recordAuthDiagnostic(
        "error",
        `${label} failed after ${Date.now() - started}ms: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onOuterAbort);
    }
  };
}
