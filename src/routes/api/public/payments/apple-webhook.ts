import { logError, sanitizeError } from "@/lib/sanitize-error";
import { createFileRoute } from "@tanstack/react-router";
import {
  createAppleVerifier,
  getServiceRoleSupabase,
  transactionToSubscriptionRow,
  type AppleEnv,
} from "@/lib/appleIap.server";
import {
  NotificationTypeV2,
  VerificationException,
  VerificationStatus,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";

/**
 * App Store Server Notifications V2 all land on this one URL regardless of
 * whether they came from Apple's sandbox or production environment — Apple
 * doesn't provide a way to tell which before verifying, so this tries
 * production first and only falls back to sandbox on the specific
 * INVALID_ENVIRONMENT failure (a real signature/chain failure is never
 * silently retried as "just the wrong environment guess" — that would mask
 * an actual forgery attempt or corrupted payload).
 */
async function verifyNotificationEitherEnvironment(
  signedPayload: string,
): Promise<{ notification: ResponseBodyV2DecodedPayload; env: AppleEnv }> {
  const order: AppleEnv[] = ["live", "sandbox"];
  let lastErr: unknown;
  for (const env of order) {
    try {
      const verifier = await createAppleVerifier(env);
      const notification = await verifier.verifyAndDecodeNotification(signedPayload);
      return { notification, env };
    } catch (err) {
      lastErr = err;
      const isEnvironmentMismatch =
        err instanceof VerificationException &&
        err.status === VerificationStatus.INVALID_ENVIRONMENT;
      if (!isEnvironmentMismatch) throw err;
    }
  }
  throw lastErr;
}

async function handleAppleNotification(signedPayload: string): Promise<void> {
  const { notification, env } = await verifyNotificationEitherEnvironment(signedPayload);

  const signedTransactionInfo = notification.data?.signedTransactionInfo;
  if (!signedTransactionInfo) {
    // Notification types like TEST carry no transaction — nothing to record.
    return;
  }

  const verifier = await createAppleVerifier(env);
  const tx = await verifier.verifyAndDecodeTransaction(signedTransactionInfo);

  if (!tx.appAccountToken) {
    // Can't happen for a transaction actually purchased through this
    // app's native flow (see appleIap.functions.ts's verifyAppleTransaction,
    // which sets appAccountToken to the signed-in user's id before
    // purchase) — but guards against a stray or legacy transaction with
    // nothing linking it to a user.
    logError(
      "[apple-webhook] transaction has no appAccountToken, skipping",
      tx.originalTransactionId,
    );
    return;
  }

  const revoked =
    notification.notificationType === NotificationTypeV2.REFUND ||
    notification.notificationType === NotificationTypeV2.REVOKE ||
    notification.notificationType === NotificationTypeV2.EXPIRED;

  const row = transactionToSubscriptionRow(tx.appAccountToken, tx, { revoked });
  const { error } = await getServiceRoleSupabase()
    .from("subscriptions")
    .upsert(row as never, { onConflict: "apple_original_transaction_id" });
  if (error) throw new Error(error.message);
}

export const Route = createFileRoute("/api/public/payments/apple-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { signedPayload?: unknown };
          if (typeof body.signedPayload !== "string") {
            logError("[apple-webhook] request missing signedPayload");
            return Response.json({ received: true, ignored: "no signedPayload" });
          }
          await handleAppleNotification(body.signedPayload);
          return Response.json({ received: true });
        } catch (e) {
          logError("[apple-webhook] error:", sanitizeError(e));
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
