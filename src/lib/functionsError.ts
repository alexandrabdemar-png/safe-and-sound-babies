// supabase-js's functions.invoke() throws a generic "Edge Function returned
// a non-2xx status code" for any 4xx/5xx response — the actual
// {error: "..."} JSON body our edge functions send back is only reachable
// via the raw Response on FunctionsHttpError's `context` property. Without
// this, a real, specific, actionable error (e.g. "You can't invite
// yourself") would show to the user as that generic message instead.
export async function extractFunctionsErrorMessage(err: unknown, fallback: string): Promise<string> {
  const context = (err as { context?: Response })?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === "string") return body.error;
    } catch {
      // Response body wasn't JSON — fall through to the generic message.
    }
  }
  return err instanceof Error ? err.message : fallback;
}
