import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Copy, RefreshCw, Trash2, Wifi } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createAuthFetch } from "@/integrations/supabase/authFetch";
import {
  clearAuthDiagnostics,
  readAuthDiagnostics,
  recordAuthDiagnostic,
  describeError,
  type AuthDiagnosticEntry,
} from "@/lib/authDiagnostics";
import { settleWithin } from "@/lib/promiseTimeout";

/**
 * Hidden sign-in diagnostics screen (five taps on the sparkle icon on
 * /auth). Shows this device's auth log, a little device context and a
 * connection test, with a Copy button, so a failed login on a real
 * iPhone/iPad can be reported exactly. Contains no passwords, tokens or
 * email addresses (see src/lib/authDiagnostics.ts).
 */
export const Route = createFileRoute("/auth-diagnostics")({
  ssr: false,
  component: AuthDiagnosticsPage,
  head: () => ({
    meta: [
      { title: "Sign-in diagnostics — Peace of Mine" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

interface DeviceContext {
  platform: string;
  native: boolean;
  online: boolean;
  origin: string;
  userAgent: string;
  session: string;
}

async function readDeviceContext(): Promise<DeviceContext> {
  let platform = "web";
  let native = false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    platform = Capacitor.getPlatform();
    native = Capacitor.isNativePlatform();
  } catch {
    /* web */
  }
  let session = "unknown";
  try {
    const { data } = await settleWithin(supabase.auth.getSession(), 5000, "Session check");
    session = data.session ? "signed in" : "signed out";
  } catch (err) {
    session = `check failed: ${describeError(err)}`;
  }
  return {
    platform,
    native,
    online: navigator.onLine,
    origin: window.location.origin,
    userAgent: navigator.userAgent,
    session,
  };
}

function formatReport(context: DeviceContext | null, entries: AuthDiagnosticEntry[]): string {
  const lines = ["Peace of Mine — sign-in diagnostics", `Generated: ${new Date().toISOString()}`];
  if (context) {
    lines.push(
      `Platform: ${context.platform} (native app: ${context.native ? "yes" : "no"})`,
      `Online: ${context.online ? "yes" : "no"}`,
      `Site: ${context.origin}`,
      `Session: ${context.session}`,
      `Device: ${context.userAgent}`,
    );
  }
  lines.push("", `Log (${entries.length} entries, oldest first):`);
  for (const e of entries) lines.push(`${e.t}  ${e.kind.toUpperCase().padEnd(7)}  ${e.detail}`);
  return lines.join("\n");
}

const KIND_STYLES: Record<AuthDiagnosticEntry["kind"], string> = {
  event: "text-primary",
  request: "text-foreground",
  timeout: "text-destructive",
  error: "text-destructive",
  info: "text-muted-foreground",
};

function AuthDiagnosticsPage() {
  const [entries, setEntries] = useState<AuthDiagnosticEntry[]>([]);
  const [context, setContext] = useState<DeviceContext | null>(null);
  const [testing, setTesting] = useState(false);

  const refresh = useCallback(() => {
    setEntries(readAuthDiagnostics());
    void readDeviceContext().then(setContext);
  }, []);

  useEffect(refresh, [refresh]);

  async function testConnection() {
    setTesting(true);
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    try {
      if (!url || !key) throw new Error("Supabase URL or key is missing from this build");
      // Goes through the same time-limited, logged fetch the app uses.
      const res = await createAuthFetch()(`${url}/auth/v1/health`, { headers: { apikey: key } });
      if (res.ok) toast.success(`Sign-in server reachable (HTTP ${res.status})`);
      else toast.error(`Sign-in server answered HTTP ${res.status}`);
    } catch (err) {
      recordAuthDiagnostic("error", `Connection test: ${describeError(err)}`);
      toast.error(`Couldn't reach the sign-in server: ${describeError(err)}`);
    } finally {
      setTesting(false);
      refresh();
    }
  }

  async function copyReport() {
    const text = formatReport(context, entries);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Diagnostics copied");
    } catch {
      toast.error("Couldn't copy. Take a screenshot instead.");
    }
  }

  function clearLog() {
    clearAuthDiagnostics();
    refresh();
  }

  const button =
    "inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-4 py-2 font-body text-xs font-medium text-foreground transition-colors hover:bg-background disabled:opacity-50";

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <Link
        to="/auth"
        className="inline-flex items-center gap-2 font-body text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to sign in
      </Link>
      <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">
        Sign-in diagnostics
      </h1>
      <p className="mt-1 font-body text-sm text-muted-foreground">
        What happened on this device during sign-in. Contains no passwords, tokens or email
        addresses.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={copyReport} className={button}>
          <Copy className="h-3.5 w-3.5" /> Copy report
        </button>
        <button type="button" onClick={testConnection} disabled={testing} className={button}>
          <Wifi className="h-3.5 w-3.5" /> {testing ? "Testing…" : "Test connection"}
        </button>
        <button type="button" onClick={refresh} className={button}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
        <button type="button" onClick={clearLog} className={button}>
          <Trash2 className="h-3.5 w-3.5" /> Clear
        </button>
      </div>

      {context && (
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-2xl border border-border/60 bg-card/80 p-4 font-body text-xs">
          <dt className="text-muted-foreground">Platform</dt>
          <dd className="text-foreground">
            {context.platform} {context.native ? "(native app)" : "(browser)"}
          </dd>
          <dt className="text-muted-foreground">Online</dt>
          <dd className="text-foreground">{context.online ? "yes" : "no"}</dd>
          <dt className="text-muted-foreground">Site</dt>
          <dd className="break-all text-foreground">{context.origin}</dd>
          <dt className="text-muted-foreground">Session</dt>
          <dd className="text-foreground">{context.session}</dd>
          <dt className="text-muted-foreground">Device</dt>
          <dd className="break-all text-foreground">{context.userAgent}</dd>
        </dl>
      )}

      <div className="mt-6 rounded-2xl border border-border/60 bg-card/80 p-4">
        {entries.length === 0 ? (
          <p className="font-body text-sm text-muted-foreground">
            Nothing logged yet. Try signing in, then come back.
          </p>
        ) : (
          <ol className="space-y-2 font-mono text-[11px] leading-relaxed">
            {[...entries].reverse().map((e, i) => (
              <li key={`${e.t}-${i}`} className="break-words">
                <span className="text-muted-foreground">{e.t.replace("T", " ").slice(0, 19)}</span>{" "}
                <span className={`font-semibold uppercase ${KIND_STYLES[e.kind]}`}>{e.kind}</span>{" "}
                <span className="text-foreground">{e.detail}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
