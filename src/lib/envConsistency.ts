// Guards against the class of bug that broke the barcode scanner:
//
// A committed `.env.development` / `.env.production` pointed at a *different*
// (stale) Supabase project than the platform-managed `.env`. Vite gives
// mode-specific env files higher priority than `.env`, so the browser bundle
// got `VITE_SUPABASE_URL` for project A while SSR / edge functions ran against
// project B. Result: the session JWT was issued by project A and rejected by
// project B ("unrecognized JWT kid ... ES256" / `UNAUTHORIZED_ASYMMETRIC_JWT`),
// and `supabase.functions.invoke("lookup-product")` failed with a generic
// error the UI surfaced as "Lookup failed — check your connection."
//
// These helpers are pure so they can be unit-tested directly, and are used by
// envConsistency.test.ts against the real repo files.

/** Minimal dotenv parser: `KEY=value`, optional quotes, `#` comments. */
export function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** `https://abc123.supabase.co` -> `abc123`. Returns null if not a project URL. */
export function projectRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = /^https:\/\/([a-z0-9]+)\.supabase\.(co|in)(\/|$)/i.exec(url.trim());
  return m ? m[1]! : null;
}

/** The JWT-format anon key embeds `"ref":"<project>"` in its payload. */
export function projectRefFromAnonKey(key: string | undefined): string | null {
  if (!key) return null;
  const parts = key.split(".");
  if (parts.length !== 3) return null; // opaque sb_publishable_ key — no ref to read
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { ref?: unknown };
    return typeof payload.ref === "string" ? payload.ref : null;
  } catch {
    return null;
  }
}

export type EnvFile = { name: string; vars: Record<string, string> };

/**
 * Collects every distinct Supabase project reference declared across the given
 * env files. A healthy project yields exactly one.
 */
export function collectProjectRefs(files: EnvFile[]): Map<string, string[]> {
  const refs = new Map<string, string[]>();
  const add = (ref: string | null, where: string) => {
    if (!ref) return;
    const list = refs.get(ref) ?? [];
    list.push(where);
    refs.set(ref, list);
  };
  for (const file of files) {
    for (const key of ["SUPABASE_URL", "VITE_SUPABASE_URL"]) {
      add(projectRefFromUrl(file.vars[key]), `${file.name}:${key}`);
    }
    for (const key of ["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
      add(projectRefFromAnonKey(file.vars[key]), `${file.name}:${key}`);
    }
    for (const key of ["SUPABASE_PROJECT_ID", "VITE_SUPABASE_PROJECT_ID"]) {
      const v = file.vars[key];
      if (v) add(v.trim(), `${file.name}:${key}`);
    }
  }
  return refs;
}

/**
 * Vite env-file precedence, lowest → highest:
 *   .env < .env.local < .env.[mode] < .env.[mode].local
 * A committed `.env.[mode]` therefore silently overrides the
 * platform-managed `.env`, which is exactly the failure mode above.
 */
export const MODE_ENV_FILES = [".env.development", ".env.production", ".env.test"] as const;
