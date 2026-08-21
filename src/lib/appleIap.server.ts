import { createClient } from "@supabase/supabase-js";
import {
  AppStoreServerAPIClient,
  SignedDataVerifier,
  Environment,
  type JWSTransactionDecodedPayload,
} from "@apple/app-store-server-library";

// subscriptions' RLS only grants `authenticated` a SELECT policy (writes
// are service_role-only, see 20260610120000_rls_audit_and_fixes.sql) —
// the same reason the Stripe webhook handler
// (src/routes/api/public/payments/webhook.ts) uses its own service-role
// client rather than the per-request, user-scoped one requireSupabaseAuth
// provides. Both the Apple purchase-verification endpoint and the Apple
// webhook need to write regardless of which user (or no user, for the
// webhook) is making the request, so both use this instead.
let _supabase: ReturnType<typeof createClient> | null = null;
export function getServiceRoleSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

// Mirrors StripeEnv (src/lib/stripe.server.ts) — the app already has one
// sandbox/live vocabulary for payments; Apple gets the same one rather
// than introducing a second. A subscriptions row's own `environment`
// column is what useSubscription()/computeIsPro() filter on, so an
// Apple-originated row must be tagged the same way a Stripe one would be
// for the same build.
export type AppleEnv = "sandbox" | "live";

function toAppleEnvironment(env: AppleEnv): Environment {
  return env === "sandbox" ? Environment.SANDBOX : Environment.PRODUCTION;
}

export function createAppleClient(env: AppleEnv): AppStoreServerAPIClient {
  const encodedKey = getEnv("APPLE_IAP_PRIVATE_KEY");
  const keyId = getEnv("APPLE_IAP_KEY_ID");
  const issuerId = getEnv("APPLE_IAP_ISSUER_ID");
  const bundleId = getEnv("APPLE_IAP_BUNDLE_ID");
  return new AppStoreServerAPIClient(
    encodedKey,
    keyId,
    issuerId,
    bundleId,
    toAppleEnvironment(env),
  );
}

// Apple's root CA certificate, fetched once per server instance and cached
// in memory rather than vendored as a file in this repo — hand-copying
// binary certificate bytes into source risks a silent transcription error
// in code whose entire job is cryptographic verification. Root certs
// rarely change, but if Apple ever rotates away from G3 before its 2039
// expiry, this URL (apple.com/certificateauthority) is where to check.
let cachedRootCerts: Buffer[] | null = null;
async function getAppleRootCertificates(): Promise<Buffer[]> {
  if (cachedRootCerts) return cachedRootCerts;
  const res = await fetch("https://www.apple.com/certificateauthority/AppleRootCA-G3.cer");
  if (!res.ok) throw new Error(`Failed to fetch Apple root certificate: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  cachedRootCerts = [Buffer.from(bytes)];
  return cachedRootCerts;
}

export async function createAppleVerifier(env: AppleEnv): Promise<SignedDataVerifier> {
  const bundleId = getEnv("APPLE_IAP_BUNDLE_ID");
  const rootCerts = await getAppleRootCertificates();
  // Apple's own library requires the numeric App Store app id (distinct
  // from the bundle id) once env is Production — sandbox verification
  // doesn't need it, since there's no live App Store listing to cross-
  // check a sandbox transaction against.
  const appAppleId = env === "live" ? Number(getEnv("APPLE_IAP_APP_APPLE_ID")) : undefined;
  // enableOnlineChecks=false: skips Apple's live per-request revocation
  // check. The actual forgery protection — verifying the JWS signature
  // against the certificate chain up to the Apple root — still happens
  // either way; this only opts out of an extra network round trip (and a
  // hard dependency on Apple's OCSP endpoint being reachable) on every
  // webhook delivery.
  return new SignedDataVerifier(rootCerts, false, toAppleEnvironment(env), bundleId, appAppleId);
}

export type AppleSubscriptionRow = {
  user_id: string;
  payment_provider: "apple";
  apple_original_transaction_id: string;
  apple_transaction_id: string;
  product_id: string;
  plan: "pro" | "free";
  status: string;
  current_period_end: string | null;
  environment: AppleEnv;
  cancel_at_period_end: boolean;
  updated_at: string;
};

/**
 * Single source of truth for turning a verified, decoded Apple transaction
 * into the row shape the rest of the app already reads
 * (computeIsPro/useSubscription in src/lib/isPro.ts and
 * src/hooks/useSubscription.ts) — mirrors what
 * handleSubscriptionUpdated() does for Stripe in
 * src/routes/api/public/payments/webhook.ts. Never trust a
 * client-reported plan/status directly: this only ever runs on a
 * transaction that has already been through SignedDataVerifier or the
 * App Store Server API, i.e. Apple's own signature already vouched for
 * every field read here.
 */
export function transactionToSubscriptionRow(
  userId: string,
  tx: JWSTransactionDecodedPayload,
  opts: { revoked?: boolean } = {},
): AppleSubscriptionRow {
  if (!tx.originalTransactionId) throw new Error("Apple transaction missing originalTransactionId");
  if (!tx.transactionId) throw new Error("Apple transaction missing transactionId");
  if (!tx.productId) throw new Error("Apple transaction missing productId");

  const expiresAt = tx.expiresDate ? new Date(tx.expiresDate) : null;
  const stillInPeriod = !!expiresAt && expiresAt.getTime() > Date.now();
  const revoked = !!opts.revoked || !!tx.revocationDate;
  const plan: "pro" | "free" = !revoked && stillInPeriod ? "pro" : "free";
  const environment: AppleEnv = tx.environment === Environment.SANDBOX ? "sandbox" : "live";

  return {
    user_id: userId,
    payment_provider: "apple",
    apple_original_transaction_id: tx.originalTransactionId,
    apple_transaction_id: tx.transactionId,
    product_id: tx.productId,
    plan,
    status: revoked ? "canceled" : stillInPeriod ? "active" : "expired",
    current_period_end: expiresAt ? expiresAt.toISOString() : null,
    environment,
    cancel_at_period_end: revoked,
    updated_at: new Date().toISOString(),
  };
}
