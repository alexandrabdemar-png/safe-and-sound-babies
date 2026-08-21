import { describe, it, expect } from "vitest";
import { transactionToSubscriptionRow } from "./appleIap.server";
import { Environment, type JWSTransactionDecodedPayload } from "@apple/app-store-server-library";

const userId = "11111111-1111-1111-1111-111111111111";

function makeTx(
  overrides: Partial<JWSTransactionDecodedPayload> = {},
): JWSTransactionDecodedPayload {
  return {
    originalTransactionId: "1000000000000001",
    transactionId: "1000000000000001",
    productId: "com.peaceofmine.app.pro.monthly",
    expiresDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
    environment: Environment.PRODUCTION,
    ...overrides,
  } as JWSTransactionDecodedPayload;
}

describe("transactionToSubscriptionRow", () => {
  it("maps an active, still-in-period transaction to plan=pro, status=active", () => {
    const row = transactionToSubscriptionRow(userId, makeTx());
    expect(row.plan).toBe("pro");
    expect(row.status).toBe("active");
    expect(row.cancel_at_period_end).toBe(false);
    expect(row.payment_provider).toBe("apple");
    expect(row.apple_original_transaction_id).toBe("1000000000000001");
    expect(row.product_id).toBe("com.peaceofmine.app.pro.monthly");
  });

  it("maps an expired transaction (expiresDate in the past) to plan=free, status=expired", () => {
    const row = transactionToSubscriptionRow(
      userId,
      makeTx({ expiresDate: Date.now() - 24 * 60 * 60 * 1000 }),
    );
    expect(row.plan).toBe("free");
    expect(row.status).toBe("expired");
  });

  it("marks a refunded/revoked transaction as plan=free, status=canceled, cancel_at_period_end=true even if still inside the paid period", () => {
    const row = transactionToSubscriptionRow(userId, makeTx(), { revoked: true });
    expect(row.plan).toBe("free");
    expect(row.status).toBe("canceled");
    expect(row.cancel_at_period_end).toBe(true);
  });

  it("treats a transaction with its own revocationDate as revoked, even without the explicit opts flag", () => {
    // A REFUND/REVOKE notification decodes to a transaction that already
    // carries revocationDate itself — the caller (apple-webhook.ts) also
    // passes { revoked: true } for those notification types, but this
    // covers the transaction-level signal alone still being honored.
    const row = transactionToSubscriptionRow(userId, makeTx({ revocationDate: Date.now() }));
    expect(row.plan).toBe("free");
    expect(row.status).toBe("canceled");
  });

  it("maps Environment.SANDBOX to 'sandbox' and Environment.PRODUCTION to 'live'", () => {
    expect(
      transactionToSubscriptionRow(userId, makeTx({ environment: Environment.SANDBOX }))
        .environment,
    ).toBe("sandbox");
    expect(
      transactionToSubscriptionRow(userId, makeTx({ environment: Environment.PRODUCTION }))
        .environment,
    ).toBe("live");
  });

  it("throws rather than silently writing a row when the transaction is missing an id Apple should always provide", () => {
    expect(() =>
      transactionToSubscriptionRow(userId, makeTx({ originalTransactionId: undefined })),
    ).toThrow(/originalTransactionId/);
    expect(() =>
      transactionToSubscriptionRow(userId, makeTx({ transactionId: undefined })),
    ).toThrow(/transactionId/);
    expect(() => transactionToSubscriptionRow(userId, makeTx({ productId: undefined }))).toThrow(
      /productId/,
    );
  });

  it("always attributes the row to the userId passed in, not anything read off the transaction itself", () => {
    const row = transactionToSubscriptionRow(userId, makeTx());
    expect(row.user_id).toBe(userId);
  });

  it("current_period_end is null when the transaction has no expiresDate at all", () => {
    const row = transactionToSubscriptionRow(userId, makeTx({ expiresDate: undefined }));
    expect(row.current_period_end).toBeNull();
    // No expiry at all is never treated as "still in period".
    expect(row.plan).toBe("free");
  });
});
