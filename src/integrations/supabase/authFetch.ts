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
// Only /auth/v1/ requests get the limit. Database queries, storage uploads
// and edge functions (some legitimately slow, like AI calls) are untouched.
import { recordAuthDiagnostic } from "@/lib/authDiagnostics";

type Fetch = typeof fetch;

export const AUTH_REQUEST_TIMEOUT_MS = 20000;

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
    if (!url.includes("/auth/v1/")) return baseFetch(input, init);

    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const label = `${method} ${describePath(url)}`;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const outer = init?.signal;
    const onOuterAbort = () => controller.abort();
    if (outer) {
      if (outer.aborted) controller.abort();
      else outer.addEventListener("abort", onOuterAbort, { once: true });
    }

    const started = Date.now();
    try {
      const res = await baseFetch(input, { ...init, signal: controller.signal });
      recordAuthDiagnostic("request", `${label} → ${res.status} (${Date.now() - started}ms)`);
      return res;
    } catch (err) {
      if (timedOut) {
        recordAuthDiagnostic("timeout", `${label} gave up after ${timeoutMs}ms`);
        throw new Error(`Auth request timed out after ${timeoutMs}ms`);
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
