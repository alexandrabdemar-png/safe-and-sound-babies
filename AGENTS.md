# Project rules

- Apple subscription discovery uses the local apple-iap package constants and requires a matching StoreKit product before enabling purchase; unavailable native products must never fall back to web checkout or fabricated prices.
- The iOS sync workflow runs a native purchase preflight against generated registration and dependencies because publishing hosted code cannot add a plugin to an existing iPhone binary.- Apple purchase rows are upserted on a full UNIQUE constraint on apple_original_transaction_id (never a partial index — ON CONFLICT cannot match it), and the client counts Apple rows in any environment because App Review buys in sandbox.
