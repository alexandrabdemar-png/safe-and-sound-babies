import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createAppleClient,
  createAppleVerifier,
  getServiceRoleSupabase,
  transactionToSubscriptionRow,
  type AppleEnv,
} from "@/lib/appleIap.server";

type VerifyResult = { ok: true; plan: "pro" | "free" } | { error: string };

/**
 * Called by the client (AppleIAPPlugin's native purchase flow, see
 * packages/apple-iap) right after StoreKit reports a successful purchase.
 * Deliberately takes only a transactionId, never a client-reported
 * price/plan/status — those are always re-fetched from Apple's own App
 * Store Server API and verified via SignedDataVerifier here, so a
 * compromised or buggy client can't grant itself Pro by simply lying about
 * what StoreKit returned. Mirrors handleWebhook()'s trust model in
 * src/routes/api/public/payments/webhook.ts, where Stripe's signature is
 * what's trusted, never the client.
 */
export const verifyAppleTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { transactionId: string; environment: AppleEnv }) => {
    if (!/^[0-9]+$/.test(data.transactionId)) throw new Error("Invalid transactionId");
    if (data.environment !== "sandbox" && data.environment !== "live") {
      throw new Error("Invalid environment");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<VerifyResult> => {
    const { userId } = context;
    try {
      const client = createAppleClient(data.environment);
      const response = await client.getTransactionInfo(data.transactionId);
      if (!response.signedTransactionInfo) {
        throw new Error("Apple returned no transaction info for this id");
      }

      const verifier = await createAppleVerifier(data.environment);
      const tx = await verifier.verifyAndDecodeTransaction(response.signedTransactionInfo);

      // appAccountToken is set to the signed-in user's own id when the
      // native plugin starts the purchase (see AppleIAPPlugin.swift's
      // purchase(), which requires it) and is echoed back by Apple on
      // every transaction tied to that purchase. Required, not just
      // checked-when-present: transaction ids are numeric and not
      // meaningfully secret, so an authenticated user guessing or
      // otherwise obtaining someone else's transactionId and calling this
      // endpoint directly must not be able to claim it just because no
      // token happened to be attached — every transaction that ever went
      // through this app's own purchase flow always has one.
      if (!tx.appAccountToken || tx.appAccountToken !== userId) {
        throw new Error("This transaction does not belong to the signed-in account");
      }

      const row = transactionToSubscriptionRow(userId, tx);
      const { error } = await getServiceRoleSupabase()
        .from("subscriptions")
        .upsert(row as never, { onConflict: "apple_original_transaction_id" });
      if (error) throw new Error(error.message);

      return { ok: true, plan: row.plan };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Could not verify purchase" };
    }
  });
